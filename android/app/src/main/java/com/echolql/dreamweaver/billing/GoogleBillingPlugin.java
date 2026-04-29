package com.echolql.dreamweaver.billing;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeResponseListener;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "GoogleBilling")
public class GoogleBillingPlugin extends Plugin {

    private static final String TAG = "GoogleBillingPlugin";

    private BillingClientManager billingClientManager;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "GoogleBillingPlugin loading...");

        billingClientManager = new BillingClientManager(
                this.getContext(),
                new BillingClientManager.BillingClientManagerListener() {
                    @Override
                    public void onBillingClientConnected() {
                        // Optionally notify JS side
                    }

                    @Override
                    public void onBillingClientDisconnected() {
                        notifyListeners("billingClientDisconnected", new JSObject());
                    }

                    @Override
                    public void onProductsQueried(Map<String, ProductDetails> products) {
                        JSObject result = new JSObject();
                        JSArray productList = new JSArray();

                        for (Map.Entry<String, ProductDetails> entry : products.entrySet()) {
                            ProductDetails pd = entry.getValue();
                            JSObject product = new JSObject();

                            String productId = pd.getProductId();
                            String formattedPrice = "unknown";
                            long priceAmountMicros = 0;
                            String currencyCode = "";

                            ProductDetails.OneTimePurchaseOfferDetails offerDetails = pd.getOneTimePurchaseOfferDetails();
                            if (offerDetails != null) {
                                formattedPrice = offerDetails.getFormattedPrice();
                                priceAmountMicros = offerDetails.getPriceAmountMicros();
                                currencyCode = offerDetails.getPriceCurrencyCode();
                            }

                            // TEST PRICE OVERRIDES
                            //if (productId.equals(BillingClientManager.PRODUCT_SMALL)) {
                            //    formattedPrice = "$0.10";
                            //    priceAmountMicros = 100000;
                            //} else if (productId.equals(BillingClientManager.PRODUCT_MEDIUM)) {
                            //    formattedPrice = "$0.20";
                            //    priceAmountMicros = 200000;
                            //} else if (productId.equals(BillingClientManager.PRODUCT_LARGE)) {
                            //    formattedPrice = "$0.25";
                            //    priceAmountMicros = 250000;
                            //}

                            product.put("productId", productId);
                            product.put("title", pd.getTitle());
                            product.put("description", pd.getDescription());
                            product.put("price", formattedPrice);
                            product.put("priceAmountMicros", priceAmountMicros);
                            product.put("currency", currencyCode);

                            productList.put(product);
                        }

                        result.put("products", productList);
                        notifyListeners("productsQueried", result);
                    }

                    @Override
                    public void onPurchaseSuccessful(Purchase purchase) {
                        JSObject result = new JSObject();
                        result.put("productId", purchase.getProducts() != null && !purchase.getProducts().isEmpty()
                                ? purchase.getProducts().get(0) : "");
                        result.put("purchaseToken", purchase.getPurchaseToken());
                        result.put("orderId", purchase.getOrderId());
                        result.put("purchaseTime", purchase.getPurchaseTime());
                        result.put("purchaseState", purchase.getPurchaseState());
                        result.put("acknowledged", purchase.isAcknowledged());
                        notifyListeners("purchaseSuccess", result);
                    }

                    @Override
                    public void onPurchaseError(String message) {
                        JSObject result = new JSObject();
                        result.put("message", message);
                        notifyListeners("purchaseError", result);
                    }
                }
        );

        Log.d(TAG, "GoogleBillingPlugin loaded successfully");
    }

    @PluginMethod
    public void queryProducts(PluginCall call) {
        if (billingClientManager == null) {
            call.reject("Billing client not initialized");
            return;
        }

        billingClientManager.queryProducts();

        // Respond immediately — results come via events
        call.resolve(new JSObject().put("status", "ok"));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        if (billingClientManager == null) {
            call.reject("Billing client not initialized");
            return;
        }

        String productId = call.getString("productId");
        if (productId == null || productId.isEmpty()) {
            call.reject("productId is required");
            return;
        }

        // BillingClient.SkuType.INAPP for one-time purchases
        String productType = call.getString("productType", BillingClient.ProductType.INAPP);

        billingClientManager.purchase(productId, productType);

        // Respond immediately — result comes via purchaseSuccess/purchaseError events
        call.resolve(new JSObject().put("status", "launched"));
    }

    @PluginMethod
    public void acknowledgePurchase(PluginCall call) {
        if (billingClientManager == null) {
            call.reject("Billing client not initialized");
            return;
        }

        String purchaseToken = call.getString("purchaseToken");
        if (purchaseToken == null || purchaseToken.isEmpty()) {
            call.reject("purchaseToken is required");
            return;
        }

        billingClientManager.acknowledgePurchase(purchaseToken, new AcknowledgePurchaseResponseListener() {
            @Override
            public void onAcknowledgePurchaseResponse(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    JSObject result = new JSObject();
                    result.put("success", true);
                    call.resolve(result);
                } else {
                    call.reject("Acknowledge failed: " + billingResult.getDebugMessage());
                }
            }
        });
    }

    @PluginMethod
    public void queryPurchases(PluginCall call) {
        if (billingClientManager == null) {
            call.reject("Billing client not initialized");
            return;
        }

        billingClientManager.queryPurchases();

        // Respond immediately — results come via events
        call.resolve(new JSObject().put("status", "ok"));
    }

    @PluginMethod
    public void consumePurchase(PluginCall call) {
        if (billingClientManager == null) {
            call.reject("Billing client not initialized");
            return;
        }

        String purchaseToken = call.getString("purchaseToken");
        if (purchaseToken == null || purchaseToken.isEmpty()) {
            call.reject("purchaseToken is required");
            return;
        }

        billingClientManager.consumePurchase(purchaseToken, new ConsumeResponseListener() {
            @Override
            public void onConsumeResponse(@NonNull BillingResult billingResult, @NonNull String purchaseToken) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    call.resolve(new JSObject()
                            .put("success", true)
                            .put("purchaseToken", purchaseToken));
                } else {
                    call.reject("Consume failed: " + billingResult.getDebugMessage());
                }
            }
        });
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        boolean connected = billingClientManager != null && billingClientManager.isConnected();
        call.resolve(new JSObject().put("connected", connected));
    }
}
