package app.netlify.franmotest;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Update only this package, through user-confirmed Android installation. */
final class AppUpdater {
    private static final long MAX_APK = 64L * 1024 * 1024;
    private static final String MANIFEST = "https://raw.githubusercontent.com/Alain-0721/french-vocabulary-test/main/website/public/android-update.json";
    private static final String RELEASE = "https://github.com/Alain-0721/french-vocabulary-test/releases/download/";
    private final MainActivity activity;
    private final SharedPreferences preferences;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private JSONObject latest;
    private String phase = "idle", message = "联网后可以检查更新";
    private int percent;
    private long lastCheck;
    private boolean busy, closed;

    AppUpdater(MainActivity activity) {
        this.activity = activity;
        preferences = activity.getSharedPreferences("app-updates", 0);
        try {
            JSONObject cached = new JSONObject(preferences.getString("latest", "{}"));
            validate(cached); latest = cached;
            if (available()) { phase = "available"; message = "发现新版本，可下载更新"; }
        } catch (Exception ignored) { latest = null; }
    }

    private synchronized boolean available() { return latest != null && latest.optInt("versionCode") > BuildConfig.VERSION_CODE; }
    synchronized String state() {
        try {
            JSONObject s = new JSONObject().put("currentVersion", BuildConfig.VERSION_NAME)
                .put("currentCode", BuildConfig.VERSION_CODE).put("phase", phase).put("message", message)
                .put("progress", percent).put("available", available()).put("lastChecked", lastCheck);
            if (latest != null) s.put("latestVersion", latest.getString("versionName")).put("notes", latest.optString("notes"));
            return s.toString();
        } catch (Exception ignored) { return "{}"; }
    }
    synchronized void publish() {
        if (!closed) activity.publishUpdate(state());
    }
    private synchronized void status(String next, String text) { phase = next; message = text; publish(); }
    private synchronized void finish(String next, String text) { busy = false; status(next, text); }

    synchronized void check(boolean manual) {
        if (closed || busy || !manual && lastCheck != 0 && System.currentTimeMillis() - lastCheck < 6 * 60 * 60 * 1000L) return;
        busy = true; status("checking", "正在检查更新…");
        worker.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = connect(new URL(MANIFEST));
                if (connection.getResponseCode() != 200) throw new IllegalStateException("Metadata unavailable");
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream in = connection.getInputStream()) {
                    byte[] buffer = new byte[4096]; int length;
                    while ((length = in.read(buffer)) != -1) {
                        if (bytes.size() + length > 64 * 1024) throw new IllegalStateException("Metadata too large");
                        bytes.write(buffer, 0, length);
                    }
                }
                JSONObject data = new JSONObject(bytes.toString("UTF-8")); validate(data);
                synchronized (this) {
                    latest = data; lastCheck = System.currentTimeMillis();
                    preferences.edit().putString("latest", data.toString()).apply();
                    finish(available() ? "available" : "current", available() ? "发现新版本，可下载更新" : "已是最新版本");
                }
            } catch (Exception error) { finish("error", "暂时无法检查更新，请联网后重试"); }
            finally { if (connection != null) connection.disconnect(); }
        });
    }

    static void validate(JSONObject data) throws Exception {
        String version = data.getString("versionName"), url = data.getString("apkUrl");
        long code = data.getLong("versionCode"), size = data.getLong("size");
        if (!BuildConfig.APPLICATION_ID.equals(data.getString("packageId")) || code < 1 || code > Integer.MAX_VALUE
            || !version.matches("[0-9]+\\.[0-9]+(?:\\.[0-9]+)?") || size < 1 || size > MAX_APK
            || !data.getString("sha256").matches("[a-fA-F0-9]{64}")) throw new IllegalStateException("Invalid metadata");
        // No remote paths or filenames supplied by the learning page are accepted.
        String expected = RELEASE + "v" + version + "/Franmotest-" + version + "-Android.apk";
        if (!url.equals(expected)) throw new IllegalStateException("Unknown release source");
    }
    private HttpURLConnection connect(URL url) throws Exception {
        if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null || url.getPort() != -1 && url.getPort() != 443)
            throw new IllegalStateException("HTTPS required");
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setUseCaches(false);
        c.setRequestProperty("User-Agent", "Franmotest/" + BuildConfig.VERSION_NAME + " Android");
        return c;
    }
    private HttpURLConnection downloadConnection(String address) throws Exception {
        URL url = new URL(address);
        for (int redirects = 0; redirects <= 5; redirects++) {
            String host = url.getHost();
            if (!(host.equals("github.com") || host.equals("release-assets.githubusercontent.com")
                || host.equals("objects.githubusercontent.com") || host.equals("github-releases.githubusercontent.com")))
                throw new IllegalStateException("Unknown download host");
            HttpURLConnection c = connect(url); int response = c.getResponseCode();
            if (response == 200) return c;
            String location = c.getHeaderField("Location"); c.disconnect();
            if (!(response == 301 || response == 302 || response == 303 || response == 307 || response == 308) || location == null)
                throw new IllegalStateException("Download unavailable");
            url = new URL(url, location);
        }
        throw new IllegalStateException("Too many redirects");
    }
    private File apkFile(JSONObject metadata) {
        return new File(new File(activity.getFilesDir(), "updates"), "update-" + metadata.optInt("versionCode") + ".apk");
    }
    synchronized void install() {
        if (closed || busy || !available()) return;
        busy = true; percent = 0; status("downloading", "正在准备更新…");
        final JSONObject metadata = latest;
        worker.execute(() -> {
            File target = apkFile(metadata), temporary = new File(target.getPath() + ".part.apk");
            HttpURLConnection c = null;
            try {
                if (target.exists()) {
                    try { verify(target, metadata); }
                    catch (Exception invalid) { if (!target.delete()) throw invalid; }
                }
                if (!target.exists()) {
                    if (!target.getParentFile().isDirectory() && !target.getParentFile().mkdirs()) throw new IllegalStateException("No update folder");
                    c = downloadConnection(metadata.getString("apkUrl")); long total = metadata.getLong("size"), received = 0;
                    try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(temporary)) {
                        byte[] buffer = new byte[64 * 1024]; int length;
                        while ((length = in.read(buffer)) != -1) {
                            if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
                            received += length; if (received > total || received > MAX_APK) throw new IllegalStateException("APK too large");
                            out.write(buffer, 0, length);
                            synchronized (this) {
                                int progress = (int) (received * 100 / total);
                                if (progress != percent) { percent = progress; status("downloading", "正在下载更新 " + percent + "%"); }
                            }
                        }
                        out.getFD().sync();
                    }
                    verify(temporary, metadata);
                    if (!temporary.renameTo(target)) throw new IllegalStateException("Unable to save APK");
                }
                activity.runOnUiThread(() -> launchInstaller(target));
            } catch (Exception failure) {
                if (temporary.exists()) temporary.delete();
                finish("error", "更新未完成，请稍后重试；学习记录不会受影响");
            } finally { if (c != null) c.disconnect(); }
        });
    }

    private void verify(File file, JSONObject metadata) throws Exception {
        if (file.length() != metadata.getLong("size")) throw new IllegalStateException("Size mismatch");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) { byte[] b = new byte[65536]; int n; while ((n = in.read(b)) != -1) digest.update(b, 0, n); }
        StringBuilder hash = new StringBuilder(); for (byte b : digest.digest()) hash.append(String.format(Locale.ROOT, "%02x", b & 255));
        if (!hash.toString().equalsIgnoreCase(metadata.getString("sha256"))) throw new IllegalStateException("Checksum mismatch");
        PackageManager pm = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags), installed = pm.getPackageInfo(BuildConfig.APPLICATION_ID, flags);
        if (archive == null || !BuildConfig.APPLICATION_ID.equals(archive.packageName)
            || versionCode(archive) != metadata.getInt("versionCode") || versionCode(archive) <= versionCode(installed)
            || !metadata.getString("versionName").equals(archive.versionName)) throw new IllegalStateException("Wrong package version");
        Signature[] old = signers(installed), next = signers(archive);
        if (old == null || next == null || old.length == 0 || old.length != next.length || !Arrays.asList(old).containsAll(Arrays.asList(next)))
            throw new IllegalStateException("Signature mismatch");
    }
    private static long versionCode(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private static Signature[] signers(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners() : info.signatures;
    }
    private synchronized void launchInstaller(File file) {
        if (closed || activity.isFinishing()) { busy = false; return; }
        try {
            if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
                status("permission", "请允许 Franmotest 安装应用，返回后继续更新");
                activity.launchUpdatePermission(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + BuildConfig.APPLICATION_ID)));
                return;
            }
            Uri uri = FileProvider.getUriForFile(activity, BuildConfig.APPLICATION_ID + ".updates", file);
            status("installing", "请在安卓安装窗口确认更新");
            activity.launchUpdateInstaller(new Intent(Intent.ACTION_INSTALL_PACKAGE).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).putExtra(Intent.EXTRA_RETURN_RESULT, true));
        } catch (Exception error) { finish("ready", "无法打开安装窗口，请重试或从网站下载新版 APK"); }
    }
    synchronized void permissionReturned() {
        busy = false;
        if (Build.VERSION.SDK_INT < 26 || activity.getPackageManager().canRequestPackageInstalls()) install();
        else status("ready", "尚未允许安装，可再次点击更新");
    }
    synchronized void installerReturned() { finish("ready", "安装窗口已关闭，可重新检查更新或继续安装"); }
    synchronized void close() { closed = true; worker.shutdownNow(); }
}
