package com.echolql.dreamweaver.billing;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingFlowParams;

import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.ConsumeResponseListener;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchaseHistoryRecord;
import com.android.billingclient.api.PurchaseHistoryResponseListener;

import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchaseHistoryParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

public class BillingClientManager implements PurchasesUpdatedListener {

    private static final String TAG = "BillingClientManager";

    // Product IDs for magic packs
    public static final String PRODUCT_SMALL  = "com.echolql.dreamweaver.credits.small";
    public static final String PRODUCT_MEDIUM  = "com.echolql.dreamweaver.credits.medium";
    public static final String PRODUCT_LARGE  = "com.echolql.dreamweaver.credits.large";

    private BillingClient billingClient;
    private boolean billingClientConnected = false;

    // Map from productId -> ProductDetails (populated after query)
    private Map<String, ProductDetails> productDetailsMap = new HashMap<>();

    private final Context context;
    private BillingClientManagerListener listener;

    public interface BillingClientManagerListener {
        void onBillingClientConnected();
        void onBillingClientDisconnected();
        void onProductsQueried(Map<String, ProductDetails> products);
        void onPurchaseSuccessful(Purchase purchase);
        void onPurchaseError(String message);
    }

    public BillingClientManager(Context context, BillingClientManagerListener listener) {
        this.context = context;
        this.listener = listener;
        initBillingClient();
    }

    private void initBillingClient() {
        billingClient = BillingClient.newBuilder(context)
                .setListener(this)
                .enablePendingPurchases()
                .build();

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingServiceDisconnected() {
                billingClientConnected = false;
                Log.e(TAG, "Billing service disconnected");
                if (listener != null) {
                    listener.onBillingClientDisconnected();
                }
            }

            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    billingClientConnected = true;
                    Log.d(TAG, "Billing client connected");
                    consumeExistingPurchases(); // Clear any unconsumed items from previous tests
                    queryProducts(); 
                    if (listener != null) {
                        listener.onBillingClientConnected();
                    }
                } else {
                    Log.e(TAG, "Billing setup failed: " + billingResult.getResponseCode() + " — " + billingResult.getDebugMessage());
                }
            }
        });
    }

    /**
     * Finds and consumes all active purchases to allow for repeat testing.
     */
    public void consumeExistingPurchases() {
        if (!billingClientConnected) return;

        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();

        billingClient.queryPurchasesAsync(params, (billingResult, purchasesList) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchasesList != null) {
                for (Purchase purchase : purchasesList) {
                    Log.d(TAG, "Cleanup: Found unconsumed purchase, consuming now: " + purchase.getPurchaseToken());
                    consumePurchase(purchase.getPurchaseToken(), (res, token) -> {
                        Log.d(TAG, "Cleanup: Consume result for " + token + ": " + res.getResponseCode());
                    });
                }
            }
        });
    }


    public boolean isConnected() {
        return billingClientConnected;
    }

    /**
     * Query available products from Google Play.
     */
    public void queryProducts() {
        if (!billingClientConnected) {
            Log.e(TAG, "queryProducts called but billing client not connected");
            if (listener != null) {
                listener.onPurchaseError("Billing client not connected");
            }
            return;
        }

        List<String> productIdList = new ArrayList<>();
        productIdList.add(PRODUCT_SMALL);
        productIdList.add(PRODUCT_MEDIUM);
        productIdList.add(PRODUCT_LARGE);

        List<QueryProductDetailsParams.Product> productListToQuery = new ArrayList<>();
        for (String productId : productIdList) {
            productListToQuery.add(
                    QueryProductDetailsParams.Product.newBuilder()
                            .setProductType(BillingClient.ProductType.INAPP)
                            .setProductId(productId)
                            .build()
            );
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productListToQuery)
                .build();

        billingClient.queryProductDetailsAsync(params, new ProductDetailsResponseListener() {
            @Override
            public void onProductDetailsResponse(@NonNull BillingResult billingResult,
                                                @Nullable List<ProductDetails> list) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    productDetailsMap.clear();
                    if (list != null) {
                        for (ProductDetails pd : list) {
                            productDetailsMap.put(pd.getProductId(), pd);
                        }
                    }
                    Log.d(TAG, "Queried " + (list != null ? list.size() : 0) + " products");
                    if (listener != null) {
                        listener.onProductsQueried(productDetailsMap);
                    }
                } else {
                    Log.e(TAG, "queryProductDetails failed: " + billingResult.getResponseCode() + " — " + billingResult.getDebugMessage());
                    if (listener != null) {
                        listener.onPurchaseError("Failed to query products: " + billingResult.getDebugMessage());
                    }
                }
            }
        });
    }

    /**
     * Launch the purchase flow for the given product.
     * @param productId The product ID to purchase
     * @param productType Always BillingClient.ProductType.INAPP for one-time purchases
     */
    public void purchase(String productId, String productType) {
        if (!billingClientConnected) {
            if (listener != null) {
                listener.onPurchaseError("Billing client not connected");
            }
            return;
        }

        ProductDetails pd = productDetailsMap.get(productId);
        if (pd == null) {
            Log.e(TAG, "Product details not found for: " + productId + ". Trying to query it now.");
            // If not found, try to query specifically
            querySingleProductAndPurchase(productId, productType);
            return;
        }

        launchBillingFlow(pd);
    }

    private void querySingleProductAndPurchase(String productId, String productType) {
        List<QueryProductDetailsParams.Product> productListToQuery = List.of(
                QueryProductDetailsParams.Product.newBuilder()
                        .setProductType(productType)
                        .setProductId(productId)
                        .build()
        );

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productListToQuery)
                .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, list) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null && !list.isEmpty()) {
                ProductDetails pd = list.get(0);
                productDetailsMap.put(pd.getProductId(), pd);
                launchBillingFlow(pd);
            } else {
                String error = "Product not found even after query: " + billingResult.getDebugMessage();
                Log.e(TAG, error);
                if (listener != null) {
                    listener.onPurchaseError("Product not found. Please ensure it is correctly configured in Google Play Console.");
                }
            }
        });
    }

    private void launchBillingFlow(ProductDetails pd) {
        // Check if getOneTimePurchaseDetails() is available for this ProductDetails object
        ProductDetails.OneTimePurchaseOfferDetails oneTimePurchaseOfferDetails = pd.getOneTimePurchaseOfferDetails();
        if (oneTimePurchaseOfferDetails == null && pd.getSubscriptionOfferDetails() == null) {
            Log.e(TAG, "No purchase offer details found for product: " + pd.getProductId());
            if (listener != null) {
                listener.onPurchaseError("Product does not have valid offer details.");
            }
            return;
        }

        // Build the BillingFlowParams using the ProductDetails object
        BillingFlowParams.ProductDetailsParams.Builder productDetailsParamsBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(pd);

        if (pd.getSubscriptionOfferDetails() != null && !pd.getSubscriptionOfferDetails().isEmpty()) {
            productDetailsParamsBuilder.setOfferToken(pd.getSubscriptionOfferDetails().get(0).getOfferToken());
        }

        BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(List.of(productDetailsParamsBuilder.build()))
                .build();

        // Launch the billing flow on a separate thread (as it might block UI)
        Executors.newSingleThreadExecutor().execute(() -> {
            BillingResult result = billingClient.launchBillingFlow(
                    (android.app.Activity) context, billingFlowParams);

            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.e(TAG, "launchBillingFlow failed: " + result.getResponseCode() + " — " + result.getDebugMessage());
                if (listener != null) {
                    listener.onPurchaseError("Failed to launch purchase: " + result.getDebugMessage());
                }
            } else {
                Log.d(TAG, "Billing flow launched successfully for: " + pd.getProductId());
            }
        });
    }

    /**
     * Acknowledge a purchase. Required for one-time purchases if auto-confirm is not enabled.
     */
    public void acknowledgePurchase(String purchaseToken, AcknowledgePurchaseResponseListener callback) {
        if (!billingClientConnected) {
            if (listener != null) {
                listener.onPurchaseError("Billing client not connected");
            }
            return;
        }

        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build();

        billingClient.acknowledgePurchase(params, callback);
    }

    /**
     * Query active (non-consumed) purchases. Use for restore.
     */
    public void queryPurchases() {
        if (!billingClientConnected) {
            if (listener != null) {
                listener.onPurchaseError("Billing client not connected");
            }
            return;
        }

        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();

        billingClient.queryPurchasesAsync(params, (billingResult, purchasesList) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                Log.d(TAG, "Found " + (purchasesList != null ? purchasesList.size() : 0) + " active purchases");
                if (listener != null && purchasesList != null) {
                    for (Purchase purchase : purchasesList) {
                        listener.onPurchaseSuccessful(purchase);
                    }
                }
            } else {
                Log.e(TAG, "queryPurchases failed: " + billingResult.getResponseCode());
            }
        });
    }

    /**
     * Query purchase history (all past purchases, even if consumed).
     */
    public void queryPurchaseHistory() {
        if (!billingClientConnected) {
            if (listener != null) {
                listener.onPurchaseError("Billing client not connected");
            }
            return;
        }

        QueryPurchaseHistoryParams params = QueryPurchaseHistoryParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();

        billingClient.queryPurchaseHistoryAsync(params, new PurchaseHistoryResponseListener() {
            @Override
            public void onPurchaseHistoryResponse(@NonNull BillingResult billingResult,
                                                  @Nullable List<PurchaseHistoryRecord> list) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "Purchase history: " + (list != null ? list.size() : 0) + " records");
                } else {
                    Log.e(TAG, "queryPurchaseHistory failed: " + billingResult.getResponseCode());
                }
            }
        });
    }

    /**
     * Consume a purchase (after verifying with backend). Call this AFTER backend confirms.
     */
    public void consumePurchase(String purchaseToken, ConsumeResponseListener callback) {
        if (!billingClientConnected) {
            if (listener != null) {
                listener.onPurchaseError("Billing client not connected");
            }
            return;
        }

        ConsumeParams params = ConsumeParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build();

        billingClient.consumeAsync(params, callback);
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> list) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            if (list != null) {
                for (Purchase purchase : list) {
                    Log.d(TAG, "Purchase updated: " + purchase.getPurchaseToken());
                    
                    // Auto-consume to allow repeat purchases for testing as requested
                    consumePurchase(purchase.getPurchaseToken(), (res, token) -> {
                        if (res.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                            Log.d(TAG, "Successfully auto-consumed purchase: " + token);
                        } else {
                            Log.e(TAG, "Failed to auto-consume: " + res.getDebugMessage());
                        }
                    });

                    if (listener != null) {
                        listener.onPurchaseSuccessful(purchase);
                    }
                }
            }
        } else if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            Log.d(TAG, "User canceled the purchase");
            if (listener != null) {
                listener.onPurchaseError("Purchase was cancelled");
            }
        } else {
            Log.e(TAG, "Purchase update error: " + billingResult.getResponseCode() + " — " + billingResult.getDebugMessage());
            if (listener != null) {
                listener.onPurchaseError("Purchase failed: " + billingResult.getDebugMessage());
            }
        }
    }

    public void endConnection() {
        if (billingClient != null) {
            billingClient.endConnection();
            billingClientConnected = false;
        }
    }
}
