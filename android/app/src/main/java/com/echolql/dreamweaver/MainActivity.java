package com.echolql.dreamweaver;

import android.os.Bundle;
import android.util.Log;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.echolql.dreamweaver.billing.GoogleBillingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Handle the splash screen transition.
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);

        Log.d("MainActivity", "onCreate called, registering GoogleBillingPlugin");
        registerPlugin(GoogleBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
