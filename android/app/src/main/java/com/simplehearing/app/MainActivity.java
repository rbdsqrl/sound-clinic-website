package com.simplehearing.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The app's own pages load from https://localhost (Capacitor's virtual origin), so an
        // XHR to the plain-HTTP local dev backend (10.0.2.2, or a LAN IP for a physical device)
        // is "mixed content" and blocked by default. network_security_config.xml already limits
        // which hosts cleartext traffic is even allowed to, so this only widens what's already a
        // narrowly-scoped local-dev exception — remove both once the app targets a real HTTPS
        // backend.
        WebSettings settings = this.bridge.getWebView().getSettings();
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }
}
