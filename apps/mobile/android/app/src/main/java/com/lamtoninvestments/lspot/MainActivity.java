package com.lamtoninvestments.lspot;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AlphaAnimation;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private static final String CLOUD_URL = "https://lspot.lamtoninvestments.com";
    private static final String LOCAL_BUNDLE_URL = "file:///android_asset/public/index.html";
    private static final int CAMERA_PERMISSION_REQ = 1001;

    private WebView webView;
    private FrameLayout splashOverlay;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme);
        super.onCreate(savedInstanceState);

        // Request Camera permission on first launch for Face Recognition
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
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new AndroidBridgeInterface(), "AndroidBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        webView.setWebViewClient(new WebViewClient() {
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
                if (request.isForMainFrame()) {
                    // Automatically fall back to bundled offline web app when offline
                    view.loadUrl(LOCAL_BUNDLE_URL);
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

        if (isNetworkConnected()) {
            webView.loadUrl(CLOUD_URL);
        } else {
            webView.loadUrl(LOCAL_BUNDLE_URL);
        }
    }

    private FrameLayout buildLuxurySplashOverlay() {
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundResource(R.drawable.splash_background);

        LinearLayout centerBox = new LinearLayout(this);
        centerBox.setOrientation(LinearLayout.VERTICAL);
        centerBox.setGravity(Gravity.CENTER);
        centerBox.setPadding(64, 64, 64, 64);

        TextView badge = new TextView(this);
        badge.setText("ENTERPRISE POS • KDS • OFFLINE ERP");
        badge.setTextColor(Color.parseColor("#FBBF24"));
        badge.setTextSize(11f);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(0, 24, 0, 12);

        TextView title = new TextView(this);
        title.setText("The LSpot Restaurant");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28f);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);

        TextView subtitle = new TextView(this);
        subtitle.setText("Manyama • Kalumbila District • Northwestern Province, Zambia");
        subtitle.setTextColor(Color.parseColor("#94A3B8"));
        subtitle.setTextSize(13f);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 8, 0, 48);

        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminate(true);

        TextView syncHint = new TextView(this);
        syncHint.setText("Initializing Biometrics & Offline Sync Engine...");
        syncHint.setTextColor(Color.parseColor("#CBD5E1"));
        syncHint.setTextSize(12f);
        syncHint.setGravity(Gravity.CENTER);
        syncHint.setPadding(0, 24, 0, 0);

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
            fadeOut.setDuration(450);
            fadeOut.setFillAfter(true);
            splashOverlay.startAnimation(fadeOut);
            splashOverlay.postDelayed(() -> splashOverlay.setVisibility(View.GONE), 460);
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

    public static class AndroidBridgeInterface {
        @JavascriptInterface
        public String getServerUrl() {
            return CLOUD_URL;
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android-apk-" + Build.MODEL;
        }
    }
}

