/**
 * Payments Service - talks to Firebase Cloud Functions for Stripe payments
 */

const PAYMENTS_BASE_URL = 'https://us-central1-storytime-e222c.cloudfunctions.net';

export interface UserCredits {
  freeStoriesRemaining: number;
  magicCredits: number;
  totalStoriesAvailable: number;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface CheckoutStatus {
  paymentStatus: string;
  status: string;
  storiesAmount: number;
}

// Magic Pack price IDs (Stripe)
export const MAGIC_PACKS = [
  { priceId: 'price_1THqOr3pQMnry1EXynDds3hO', name: 'Small Magic Pack', stories: 20, priceCents: 500 },
  { priceId: 'price_1THqPq3pQMnry1EXURJnDIe4', name: 'Medium Magic Pack', stories: 40, priceCents: 800 },
  { priceId: 'price_1THqQU3pQMnry1EXPQfIOKy7', name: 'Large Magic Pack', stories: 65, priceCents: 1000 },
  { priceId: 'price_1THqR93pQMnry1EXnSX8dhBz', name: 'Mega Magic Pack', stories: 100, priceCents: 1200 },
];

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
 * Create a Stripe Checkout Session for the given price pack.
 * Returns the Stripe payment URL to open.
 */
export async function createCheckoutSession(uid: string, priceId: string): Promise<CheckoutSession> {
  const url = `${PAYMENTS_BASE_URL}/createCheckoutSession`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, priceId }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to create checkout session: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Check the status of a Stripe Checkout Session.
 */
export async function getCheckoutSession(sessionId: string): Promise<CheckoutStatus> {
  const url = `${PAYMENTS_BASE_URL}/getCheckoutSession?sessionId=${encodeURIComponent(sessionId)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to get checkout session: ${resp.status}`);
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
