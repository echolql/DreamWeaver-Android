/**
 * Payments Service - Google Play Billing via custom Capacitor plugin
 *
 * The native plugin (GoogleBillingPlugin.java) is registered automatically
 * via the @CapacitorPlugin annotation. On the JS side, Capacitor generates
 * a proxy object at window.Capacitor.Plugins.GoogleBilling.
 */

import { registerPlugin } from '@capacitor/core';

// This MUST match the @CapacitorPlugin(name = "GoogleBilling") 
// defined in your GoogleBillingPlugin.java
const GoogleBilling = registerPlugin<any>('GoogleBilling');

export const purchaseProduct = async (productId: string) => {
  // Always check the platform first to avoid the 
  // "Plugin not available" error on web/iOS
  if (Capacitor.getPlatform() === 'android') {
    return await GoogleBilling.purchase({ productId });
  } else {
    console.warn("Native billing is only available on Android.");
  }
};

const PAYMENTS_BASE_URL = 'https://us-central1-storytime-e222c.cloudfunctions.net';

export interface UserCredits {
  freeStoriesRemaining: number;
  magicCredits: number;
  totalStoriesAvailable: number;
}

// Magic Pack definitions (Google Play product IDs)
export const MAGIC_PACKS = [
  { productId: 'com.echolql.dreamweaver.credits.small', name: 'Small Magic Pack', stories: 20, priceCents: 500 },
  { productId: 'com.echolql.dreamweaver.credits.medium', name: 'Medium Magic Pack', stories: 50, priceCents: 1000 },
  { productId: 'com.echolql.dreamweaver.credits.large', name: 'Large Magic Pack', stories: 100, priceCents: 1800 },
];

// Pack → credits mapping (used to tell backend how many credits to grant after purchase)
export const CREDIT_AMOUNTS: Record<string, number> = {
  'com.echolql.dreamweaver.credits.small': 20,
  'com.echolql.dreamweaver.credits.medium': 50,
  'com.echolql.dreamweaver.credits.large': 100,
};

/**
 * Purchase a magic pack via Google Play Billing.
 * Resolves when the purchase is acknowledged and verified with the backend.
 * Throws on failure or cancellation.
 */
export async function purchaseCredits(productId: string, uid: string): Promise<void> {
  // Access the native plugin via Capacitor's auto-generated bridge
  const billing = (window as any).Capacitor?.Plugins?.GoogleBilling;
  if (!billing) {
    throw new Error('Google Billing plugin not available. Is this running on Android?');
  }

  return new Promise((resolve, reject) => {
    let resolved = false;

    // Listen for successful purchase
    const successHandler = (event: any) => {
      if (resolved || event.productId !== productId) return;
      resolved = true;
      cleanup();
      handlePurchaseSuccess(event, uid, productId).then(resolve).catch(reject);
    };

    // Listen for purchase error
    const errorHandler = (event: any) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error(event.message || 'Purchase failed'));
    };

    const cleanup = () => {
      billing.removeListener('purchaseSuccess', successHandler);
      billing.removeListener('purchaseError', errorHandler);
    };

    billing.addListener('purchaseSuccess', successHandler);
    billing.addListener('purchaseError', errorHandler);

    // Launch the purchase flow
    billing
      .purchase({ productId, productType: 'inapp' })
      .then((result: any) => {
        // If the flow didn't launch (immediate error), reject
        if (!resolved && result?.status === 'error') {
          resolved = true;
          cleanup();
          reject(new Error(result.message || 'Failed to launch purchase'));
        }
        // Otherwise wait for the event handlers above
      })
      .catch((err: any) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(err);
        }
      });

    // Safety timeout after 3 minutes
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Purchase timed out after 3 minutes'));
      }
    }, 180_000);
  });
}

/**
 * Handle a successful Google Play purchase:
 * 1. Acknowledge the purchase (if not auto-acknowledged)
 * 2. Verify with backend and grant credits
 */
async function handlePurchaseSuccess(
  event: { productId: string; purchaseToken: string; acknowledged: boolean },
  uid: string,
  productId: string
): Promise<void> {
  const billing = (window as any).Capacitor?.Plugins?.GoogleBilling;

  // 1. Acknowledge if needed
  if (!event.acknowledged) {
    await billing.acknowledgePurchase({ purchaseToken: event.purchaseToken });
  }

  // 2. Verify with backend and grant credits
  await verifyAndGrantCredits(uid, productId, event.purchaseToken);
}

/**
 * Tell backend to verify the Google Play purchase and grant credits.
 * The backend should call the Google Play Developer API to verify the token
 * before granting credits server-side.
 */
async function verifyAndGrantCredits(
  uid: string,
  productId: string,
  purchaseToken: string
): Promise<void> {
  const credits = CREDIT_AMOUNTS[productId];
  if (!credits) throw new Error(`Unknown product ID: ${productId}`);

  const url = `${PAYMENTS_BASE_URL}/verifyGooglePlayPurchase`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, productId, purchaseToken, credits }),
  });
  if (!resp.ok) {
    throw new Error(`Backend verification failed: ${resp.status}`);
  }
}

/**
 * Get current user's credit balance from Cloud Functions.
 */
export async function getUserCredits(uid: string): Promise<UserCredits> {
  const url = `${PAYMENTS_BASE_URL}/getUserCredits?uid=${encodeURIComponent(uid)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch credits: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Deduct 1 credit for the current user.
 * Throws if user has no credits.
 */
export async function useCredit(uid: string): Promise<UserCredits> {
  const url = `${PAYMENTS_BASE_URL}/useCredit`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `useCredit failed: ${resp.status}`);
  }
  return resp.json();
}
