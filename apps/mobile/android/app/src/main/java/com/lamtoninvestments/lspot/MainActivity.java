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

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "LSpotPOS";
    private static final String CLOUD_URL = "https://lspot.lamtoninvestments.com";
    private static final String LOCAL_ORIGIN = "appassets.androidplatform.net";
    private static final String LOCAL_BUNDLE_URL = "https://" + LOCAL_ORIGIN + "/index.html";
    private static final int CAMERA_PERMISSION_REQ = 1001;

    private WebView webView;
    private FrameLayout splashOverlay;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme);
        super.onCreate(savedInstanceState);

        try {
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
                    if (request == null || request.getUrl() == null) {
                        return super.shouldInterceptRequest(view, request);
                    }
                    Uri uri = request.getUrl();
                    String host = uri.getHost();
                    if (host != null && (host.equalsIgnoreCase(LOCAL_ORIGIN) || host.equalsIgnoreCase("localhost"))) {
                        return handleLocalAssetRequest(uri);
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    dismissNativeSplash();
                }

                private long lastReloadTime = 0;

                @Override
                public void onReceivedError(
                        WebView view,
                        WebResourceRequest request,
                        WebResourceError error
                ) {
                    if (request != null && request.isForMainFrame()) {
                        String failingUrl = request.getUrl() != null ? request.getUrl().toString() : "";
                        Log.w(TAG, "MainFrame navigation error on URL: " + failingUrl);
                        // Prevent recursive reload / crash loop if local bundle encountered an error
                        if (!failingUrl.startsWith("https://" + LOCAL_ORIGIN)) {
                            long now = System.currentTimeMillis();
                            if (now - lastReloadTime > 5000) {
                                lastReloadTime = now;
                                mainHandler.post(() -> {
                                    if (webView != null) {
                                        webView.loadUrl(LOCAL_BUNDLE_URL);
                                    }
                                });
                            }
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

            // Safety timeout: dismiss splash after 3 seconds so screen is never blocked
            mainHandler.postDelayed(this::dismissNativeSplash, 3000);

            // True Offline-First Architecture:
            // Always boot from local bundled assets on appassets.androidplatform.net
            // Instant startup, 100% offline resiliency, and permanent origin stability for localStorage/IndexedDB
            webView.loadUrl(LOCAL_BUNDLE_URL);

        } catch (Throwable t) {
            Log.e(TAG, "Fatal error initializing MainActivity", t);
        }
    }

    private WebResourceResponse handleLocalAssetRequest(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty() || path.equals("/")) {
            path = "index.html";
        }
        if (path.startsWith("/")) {
            path = path.substring(1);
        }

        // Clean out query parameters or hashes
        int q = path.indexOf('?');
        if (q >= 0) {
            path = path.substring(0, q);
        }
        int h = path.indexOf('#');
        if (h >= 0) {
            path = path.substring(0, h);
        }

        try {
            InputStream is = getAssets().open("public/" + path);
            String mime = getMimeType(path);
            String encoding = isBinaryMime(mime) ? null : "UTF-8";
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            headers.put("Access-Control-Allow-Headers", "*");
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mime, encoding, 200, "OK", headers, is);
        } catch (IOException e) {
            // Single-Page Application (SPA) Fallback:
            // Route missing sub-paths (e.g. /kitchen, /pos, /shifts) to index.html
            if (!path.contains(".") || path.endsWith(".html")) {
                try {
                    InputStream is = getAssets().open("public/index.html");
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Access-Control-Allow-Origin", "*");
                    headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                    headers.put("Access-Control-Allow-Headers", "*");
                    return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, is);
                } catch (IOException ex) {
                    return null;
                }
            }
            return null;
        }
    }

    private boolean isBinaryMime(String mime) {
        if (mime == null) return false;
        return mime.startsWith("image/") || mime.startsWith("font/") || mime.startsWith("audio/") || mime.equals("application/octet-stream");
    }

    private String getMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
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
        try {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        } catch (Exception ignored) {}
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
            fadeOut.setDuration(350);
            fadeOut.setFillAfter(true);
            splashOverlay.startAnimation(fadeOut);
            splashOverlay.postDelayed(() -> splashOverlay.setVisibility(View.GONE), 360);
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
                if (webView != null) {
                    webView.clearCache(true);
                    webView.loadUrl(LOCAL_BUNDLE_URL + "?t=" + System.currentTimeMillis());
                }
            });
        }

        @JavascriptInterface
        public void switchToLiveCloud() {
            // Retain local bundle origin to preserve offline localStorage continuity
            reloadLiveCloud();
        }
    }
}
