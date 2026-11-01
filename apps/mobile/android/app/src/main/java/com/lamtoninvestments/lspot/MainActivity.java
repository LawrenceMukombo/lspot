package com.lamtoninvestments.lspot;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AlphaAnimation;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.InputStream;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "LSpotPOS";
    private static final String CLOUD_URL = "https://lspot.lamtoninvestments.com";
    private static final String LOCAL_ORIGIN = "appassets.androidplatform.net";
    private static final String LOCAL_BUNDLE_URL = "https://" + LOCAL_ORIGIN + "/index.html";
    private static final int CAMERA_PERMISSION_REQ = 1001;

    private WebView webView;
    private FrameLayout splashOverlay;
    private WebViewAssetLoader assetLoader;
    private boolean hasFallenBackToLocal = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme);
        super.onCreate(savedInstanceState);

        try {
            initAssetLoader();

            // Request Camera permission for Face Recognition if not granted
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.CAMERA},
                        CAMERA_PERMISSION_REQ
                );
            }

            FrameLayout root = new FrameLayout(this);
            root.setBackgroundColor(Color.parseColor("#060911"));

            webView = new WebView(this);
            webView.setBackgroundColor(Color.parseColor("#060911"));
            configureWebViewSettings(webView.getSettings());

            webView.addJavascriptInterface(new AndroidBridgeInterface(), "AndroidBridge");

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        try {
                            request.grant(request.getResources());
                        } catch (Exception e) {
                            Log.w(TAG, "Permission request grant failed", e);
                        }
                    });
                }
            });

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    try {
                        Uri uri = request.getUrl();
                        if (uri != null && LOCAL_ORIGIN.equalsIgnoreCase(uri.getHost())) {
                            return assetLoader.shouldInterceptRequest(uri);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Error in assetLoader interception", e);
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    dismissNativeSplash();
                }

                @Override
                public void onReceivedError(
                        WebView view,
                        WebResourceRequest request,
                        WebResourceError error
                ) {
                    if (request != null && request.isForMainFrame()) {
                        Log.w(TAG, "MainFrame error on URL: " + request.getUrl());
                        // Fall back to bundled offline web app if not already on it
                        if (!hasFallenBackToLocal) {
                            hasFallenBackToLocal = true;
                            mainHandler.post(() -> {
                                if (webView != null) {
                                    webView.loadUrl(LOCAL_BUNDLE_URL);
                                }
                            });
                        }
                    }
                }
            });

            splashOverlay = buildLuxurySplashOverlay();

            root.addView(webView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            ));
            root.addView(splashOverlay, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            ));

            setContentView(root);

            // Safety timeout: dismiss splash after 4.5 seconds even on slow networks
            mainHandler.postDelayed(this::dismissNativeSplash, 4500);

            if (isNetworkConnected()) {
                webView.loadUrl(CLOUD_URL);
            } else {
                hasFallenBackToLocal = true;
                webView.loadUrl(LOCAL_BUNDLE_URL);
            }
        } catch (Throwable t) {
            Log.e(TAG, "Fatal error initializing MainActivity", t);
        }
    }

    private void initAssetLoader() {
        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(LOCAL_ORIGIN)
                .addPathHandler("/", path -> {
                    try {
                        String cleanPath = path;
                        if (cleanPath.startsWith("/")) {
                            cleanPath = cleanPath.substring(1);
                        }
                        if (cleanPath.isEmpty()) {
                            cleanPath = "index.html";
                        }
                        String assetPath = "public/" + cleanPath;
                        InputStream is = getAssets().open(assetPath);

                        String mimeType = "text/html";
                        if (cleanPath.endsWith(".js")) mimeType = "application/javascript";
                        else if (cleanPath.endsWith(".css")) mimeType = "text/css";
                        else if (cleanPath.endsWith(".json")) mimeType = "application/json";
                        else if (cleanPath.endsWith(".png")) mimeType = "image/png";
                        else if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) mimeType = "image/jpeg";
                        else if (cleanPath.endsWith(".svg")) mimeType = "image/svg+xml";
                        else if (cleanPath.endsWith(".woff2")) mimeType = "font/woff2";

                        return new WebResourceResponse(mimeType, "UTF-8", is);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .build();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebViewSettings(WebSettings settings) {
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(false);
        }
    }

    private FrameLayout buildLuxurySplashOverlay() {
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.parseColor("#060911"));

        LinearLayout centerBox = new LinearLayout(this);
        centerBox.setOrientation(LinearLayout.VERTICAL);
        centerBox.setGravity(Gravity.CENTER);
        centerBox.setPadding(48, 48, 48, 48);

        TextView badge = new TextView(this);
        badge.setText("ENTERPRISE POS • KDS • OFFLINE ERP");
        badge.setTextColor(Color.parseColor("#FBBF24"));
        badge.setTextSize(11f);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(0, 16, 0, 8);

        TextView title = new TextView(this);
        title.setText("The LSpot Restaurant");
        title.setTextColor(Color.WHITE);
        title.setTextSize(26f);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(Typeface.DEFAULT_BOLD);

        TextView subtitle = new TextView(this);
        subtitle.setText("Manyama • Kalumbila District • Northwestern Province, Zambia");
        subtitle.setTextColor(Color.parseColor("#94A3B8"));
        subtitle.setTextSize(12f);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 8, 0, 36);

        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminate(true);

        TextView syncHint = new TextView(this);
        syncHint.setText("Initializing Biometrics & Offline Engine...");
        syncHint.setTextColor(Color.parseColor("#CBD5E1"));
        syncHint.setTextSize(11f);
        syncHint.setGravity(Gravity.CENTER);
        syncHint.setPadding(0, 20, 0, 0);

        centerBox.addView(badge);
        centerBox.addView(title);
        centerBox.addView(subtitle);
        centerBox.addView(spinner);
        centerBox.addView(syncHint);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        container.addView(centerBox, params);
        return container;
    }

    private void dismissNativeSplash() {
        if (splashOverlay != null && splashOverlay.getVisibility() == View.VISIBLE) {
            AlphaAnimation fadeOut = new AlphaAnimation(1.0f, 0.0f);
            fadeOut.setDuration(400);
            fadeOut.setFillAfter(true);
            splashOverlay.startAnimation(fadeOut);
            splashOverlay.postDelayed(() -> splashOverlay.setVisibility(View.GONE), 410);
        }
    }

    private boolean isNetworkConnected() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnected();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class AndroidBridgeInterface {
        @JavascriptInterface
        public String getServerUrl() {
            return CLOUD_URL;
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android-apk-" + Build.MODEL;
        }

        @JavascriptInterface
        public void reloadLiveCloud() {
            runOnUiThread(() -> {
                if (webView != null && isNetworkConnected()) {
                    hasFallenBackToLocal = false;
                    webView.clearCache(true);
                    webView.loadUrl(CLOUD_URL + "/?v=" + System.currentTimeMillis());
                }
            });
        }

        @JavascriptInterface
        public void switchToLiveCloud() {
            runOnUiThread(() -> {
                if (webView != null && isNetworkConnected()) {
                    String currentUrl = webView.getUrl();
                    if (currentUrl != null && currentUrl.contains(LOCAL_ORIGIN)) {
                        hasFallenBackToLocal = false;
                        webView.loadUrl(CLOUD_URL);
                    }
                }
            });
        }
    }
}
