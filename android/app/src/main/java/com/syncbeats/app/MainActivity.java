package com.syncbeats.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen awake while app is active
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Configure WebView for background media and timers
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Prevent Android from freezing JavaScript timers and background audio
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        // Maintain timer execution when app is hidden in background
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }
}
