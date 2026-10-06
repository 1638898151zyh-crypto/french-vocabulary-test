package app.netlify.franmotest;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** APK-owned screens and banks. Online paths are restricted to existing APIs. */
public final class MainActivity extends ComponentActivity {
    static final String HOST = "franmotest.netlify.app";
    static final String HOME = "https://" + HOST + "/#/home";
    private WebView web;
    private FrameLayout root;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingExport;
    private long lastBack;
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private final ActivityResultLauncher<Intent> filePicker = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(), result -> {
            if (fileCallback == null) return;
            Uri[] files = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData());
            fileCallback.onReceiveValue(files);
            fileCallback = null;
        });
    private final ActivityResultLauncher<Intent> exportPicker = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(), result -> {
            byte[] bytes = pendingExport;
            pendingExport = null;
            if (result.getResultCode() != RESULT_OK || result.getData() == null || bytes == null) return;
            Uri destination = result.getData().getData();
            if (destination == null || !"content".equals(destination.getScheme())) return;
            writer.execute(() -> {
                try (OutputStream stream = getContentResolver().openOutputStream(destination, "wt")) {
                    if (stream == null) throw new IOException("No output stream");
                    stream.write(bytes);
                    runOnUiThread(() -> toast("文件已保存"));
                } catch (IOException | SecurityException exception) {
                    runOnUiThread(() -> toast("保存失败，请重新选择保存位置"));
                }
            });
        });

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(247, 248, 252));
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        createWebView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                web.evaluateJavascript("Boolean(window.franmotestBack?.())", handled -> {
                    if ("true".equals(handled)) return;
                    if (web.canGoBack()) { web.goBack(); return; }
                    long now = android.os.SystemClock.elapsedRealtime();
                    if (now - lastBack < 2000) finish();
                    else { lastBack = now; toast("再按一次返回键退出"); }
                });
            }
        });
        web.loadUrl(startUrl(getIntent()));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247, 248, 252));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // For files explicitly chosen by the user.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new NativeBridge(), "FranmotestNative");
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder().setDomain(HOST)
            .addPathHandler("/", path -> {
                // API requests fall through to the owned website, keeping same-origin auth.
                if (path.startsWith("api/") || path.startsWith(".netlify/identity/")
                    || path.startsWith(".netlify/functions/")) return null;
                if (path.isEmpty()) path = "index.html";
                if (path.contains("..") || path.contains("\\")) return missingAsset();
                try {
                    WebResourceResponse response = new WebResourceResponse(mimeFor(path), "UTF-8", getAssets().open("public/" + path));
                    HashMap<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-store");
                    headers.put("X-Content-Type-Options", "nosniff");
                    response.setResponseHeaders(headers);
                    return response;
                } catch (IOException exception) {
                    // Missing local files must never silently fetch a remote learning screen.
                    return missingAsset();
                }
            }).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!"https".equals(request.getUrl().getScheme()) || !HOST.equals(request.getUrl().getHost()))
                    return missingAsset();
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isAppUrl(uri)) return false;
                if (request.hasGesture()) openExternal(uri);
                return true;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Android 6 uses this overload; explicit external taps use the native bridge.
                return !isAppUrl(Uri.parse(url));
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                root.removeView(view);
                view.destroy();
                createWebView();
                web.loadUrl(HOME);
                toast("学习界面已重新打开，已保存的记录会保留");
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                String[] accept = params.getAcceptTypes();
                if (accept.length > 0 && accept[0].startsWith("image/")) intent.setType("image/*");
                try { filePicker.launch(intent); }
                catch (ActivityNotFoundException exception) { fileCallback.onReceiveValue(null); fileCallback = null; toast("无法打开文件选择器"); }
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String message, android.webkit.JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm())
                    .setNegativeButton("取消", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
    }
    private static WebResourceResponse missingAsset() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(),
            new ByteArrayInputStream(new byte[0]));
    }
    private static String mimeFor(String path) {
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }
    private static boolean isAppUrl(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443)
            && ("/".equals(uri.getPath()) || "/index.html".equals(uri.getPath()));
    }
    private String startUrl(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        return isAppUrl(uri) ? uri.toString() : HOME;
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (isAppUrl(intent.getData())) web.loadUrl(startUrl(intent));
    }
    private void openExternal(Uri uri) {
        if (uri == null || !("https".equals(uri.getScheme()) || "mailto".equals(uri.getScheme()))) return;
        Intent intent = new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE);
        try { startActivity(intent); } catch (ActivityNotFoundException exception) { toast("没有可打开此链接的应用"); }
    }
    public final class NativeBridge {
        @JavascriptInterface public void saveText(String filename, String text, String mime) {
            if (text == null || text.length() > 16 * 1024 * 1024) { runOnUiThread(() -> toast("导出文件过大，请按课本分别导出")); return; }
            runOnUiThread(() -> {
                if (pendingExport != null) { toast("请先完成当前文件保存"); return; }
                String name = filename == null ? "Franmotest-backup.json" : filename.replaceAll("[\\\\/\\r\\n]", "_");
                if (name.length() > 180) name = name.substring(0, 180);
                String type = "application/json".equals(mime) || "text/csv".equals(mime) || "text/markdown".equals(mime) ? mime : "text/plain";
                pendingExport = text.getBytes(StandardCharsets.UTF_8);
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(type).putExtra(Intent.EXTRA_TITLE, name);
                try { exportPicker.launch(intent); }
                catch (ActivityNotFoundException exception) { pendingExport = null; toast("无法打开文件保存窗口"); }
            });
        }
        @JavascriptInterface public void openExternal(String url) {
            runOnUiThread(() -> MainActivity.this.openExternal(Uri.parse(url == null ? "" : url)));
        }
        @JavascriptInterface public void setDark(boolean dark) {
            runOnUiThread(() -> {
                root.setBackgroundColor(dark ? Color.rgb(23, 33, 46) : Color.rgb(247, 248, 252));
                WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightStatusBars(!dark);
                WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightNavigationBars(!dark);
            });
        }
    }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_SHORT).show(); }
    @Override protected void onPause() { CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (web != null) { web.removeJavascriptInterface("FranmotestNative"); web.destroy(); }
        writer.shutdown();
        super.onDestroy();
    }
}
