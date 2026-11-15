package io.freemytv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * FreeTV's home screen (the same web app LG and Samsung run, home/ built by tools/build_home.py --android into
 * assets/freetv) in a WebView, with the TV behind window.FreeTVHost (home/tv.js, the "android" TV):
 * the apps (their banners served at https://freetv.local/icon/<package>), the HDMI inputs, opening them, the TV's
 * settings, and installing Stremio Origin from its GitHub release. The remote's Back and colour keys reach the page as
 * the key codes LG's remote sends (461, 403-406), so home.js handles them as on LG.
 */
final class WebHome {
    private static final String ICON_HOST = "https://freetv.local/icon/";
    static final String STREMIO = "tv.stremioorigin.app";   // Stremio Claude (PharmaJava/webos), Stremio Origin's id
    /** Apps FreeTV can install from GitHub (an APK and the SHA256SUMS of the same release): package → GitHub project. */
    static final Map<String, String> GITHUB = new HashMap<>();
    static {
        GITHUB.put(STREMIO, "PharmaJava/webos");
    }

    private final Activity activity;
    final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Map<String, byte[]> icons = new HashMap<>();
    private volatile String installState = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    WebHome(Activity a) {
        activity = a;
        web = new WebView(a);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // FreeTV keeps its settings in localStorage, as on the TVs
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        // The page is a local file and asks weather, quotes, TMDB… directly, as LG's and Samsung's own web runtimes let it.
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setTextZoom(100);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        web.setInitialScale(0);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.addJavascriptInterface(new Host(), "FreeTVHost");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                String u = req.getUrl().toString();
                if (u.equals("file:///android_asset/freetv/config.js")) return config();
                if (!u.startsWith(ICON_HOST)) return null;
                byte[] png = icon(Uri.decode(u.substring(ICON_HOST.length())));
                if (png == null) return new WebResourceResponse("image/png", null, 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
                Map<String, String> h = new HashMap<>();
                h.put("Cache-Control", "max-age=86400");
                h.put("Access-Control-Allow-Origin", "*");
                return new WebResourceResponse("image/png", null, 200, "OK", h, new ByteArrayInputStream(png));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !req.getUrl().toString().startsWith("file:///android_asset/");   // the home never leaves itself
            }
        });
        web.loadUrl("file:///android_asset/freetv/index.html");
        refreshCatalog(false);
    }

    View view() { return web; }

    /**
     * config.js with the installer's settings laid over the built-in ones (Prefs.freetvConfig): what the LG installer writes into
     * its package. data.js then keeps them in fmtv.cfg as on LG. Without installer settings, the file as built.
     */
    private WebResourceResponse config() {
        String extra = Prefs.freetvConfig();
        if (extra.isEmpty()) return null;
        try (InputStream in = activity.getAssets().open("freetv/config.js")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            JSONObject o = new JSONObject(extra);   // checked again: only a JSON object goes into the page
            String js = out.toString("UTF-8") + "\n/* The installer's settings (FREETVAPPWEB). */\n(function (o) { for (var k in o) if (k !== 'version') window.CONFIG[k] = o[k]; })("
                    + o.toString() + ");\n";
            return new WebResourceResponse("application/javascript", "UTF-8", new ByteArrayInputStream(js.getBytes("UTF-8")));
        } catch (Exception e) {
            AppLog.w("config.js: " + e.getMessage());
            return null;
        }
    }

    void resume() { web.onResume(); js("window.FreeTVHostEvent && FreeTVHostEvent('resume')"); }

    void pause() { js("window.FreeTVHostEvent && FreeTVHostEvent('pause')"); web.onPause(); }

    /** The Home button while the home is already in front. */
    void home() { js("window.FreeTVHostEvent && FreeTVHostEvent('home')"); }

    void destroy() { web.destroy(); }

    /** Keys the WebView would not pass to the page as LG's remote sends them: Back, OK and the colour keys. */
    boolean onKey(KeyEvent e) {
        int code;
        switch (e.getKeyCode()) {
            case KeyEvent.KEYCODE_BACK: case KeyEvent.KEYCODE_ESCAPE: code = 461; break;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER: case KeyEvent.KEYCODE_NUMPAD_ENTER: code = 13; break;
            case KeyEvent.KEYCODE_PROG_RED: code = 403; break;
            case KeyEvent.KEYCODE_PROG_GREEN: code = 404; break;
            case KeyEvent.KEYCODE_PROG_YELLOW: code = 405; break;
            case KeyEvent.KEYCODE_PROG_BLUE: code = 406; break;
            default: return false;
        }
        String type = e.getAction() == KeyEvent.ACTION_DOWN ? "keydown" : e.getAction() == KeyEvent.ACTION_UP ? "keyup" : null;
        if (type != null) js("window.FreeTVHostKey && FreeTVHostKey('" + type + "'," + code + ")");
        return true;
    }

    private void js(final String code) {
        ui.post(new Runnable() { public void run() { web.evaluateJavascript(code, null); } });
    }

    // MARK: - Icons

    private synchronized byte[] icon(String pkg) {
        if (icons.containsKey(pkg)) return icons.get(pkg);
        byte[] png = null;
        try {
            PackageManager pm = activity.getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            Drawable d = ai.loadBanner(pm);
            if (d == null) d = ai.loadLogo(pm);
            if (d == null) d = ai.loadIcon(pm);
            int w = Math.max(1, Math.min(d.getIntrinsicWidth() > 0 ? d.getIntrinsicWidth() : 320, 640));
            int h = Math.max(1, Math.min(d.getIntrinsicHeight() > 0 ? d.getIntrinsicHeight() : 180, 360));
            Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(b);
            d.setBounds(0, 0, w, h);
            d.draw(c);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.PNG, 100, out);
            png = out.toByteArray();
        } catch (Exception e) {
            AppLog.w("icon " + pkg + ": " + e.getMessage());
        }
        icons.put(pkg, png);
        return png;
    }

    private static boolean hasBanner(PackageManager pm, String pkg) {
        try { return pm.getApplicationInfo(pkg, 0).banner != 0; } catch (Exception e) { return false; }
    }

    // MARK: - The Store's catalog (android/catalog.json: tools/android_catalog.py pins each APK's SHA-256)

    static final String CATALOG_URL = "https://raw.githubusercontent.com/PharmaJava/FreeTV/main/android/catalog.json";
    private static final long CATALOG_EVERY = 6 * 3600 * 1000L;

    /** The newest catalog this TV has: the one fetched from GitHub (kept in files/), else the one built into the app. */
    private synchronized JSONObject catalog() {
        File kept = new File(activity.getFilesDir(), "catalog.json");
        try {
            if (kept.isFile()) return new JSONObject(readText(new FileInputStream(kept)));
        } catch (Exception e) { AppLog.w("catalog (kept): " + e.getMessage()); }
        try {
            return new JSONObject(readText(activity.getAssets().open("catalog.json")));
        } catch (Exception e) { return new JSONObject(); }
    }

    /** Fetches the catalog from GitHub at most every six hours (in the background); only a catalog that reads well is kept. */
    private void refreshCatalog(boolean now) {
        final File kept = new File(activity.getFilesDir(), "catalog.json");
        if (!now && kept.isFile() && System.currentTimeMillis() - kept.lastModified() < CATALOG_EVERY) return;
        new Thread(new Runnable() { public void run() {
            try {
                String text = get(CATALOG_URL);
                JSONArray apps = new JSONObject(text).getJSONArray("apps");
                for (int i = 0; i < apps.length(); i++) if (entryProblem(apps.getJSONObject(i)) != null) throw new IOException("bad entry " + i);
                File tmp = new File(kept.getPath() + ".tmp");
                try (OutputStream o = new FileOutputStream(tmp)) { o.write(text.getBytes("UTF-8")); }
                if (!tmp.renameTo(kept)) throw new IOException("rename");
            } catch (Exception e) { AppLog.w("catalog: " + e.getMessage()); }
        }}, "freetv-catalog").start();
    }

    /** null when an entry is one the TV may install: a package name, a github.com download of its own project, a SHA-256. */
    static String entryProblem(JSONObject e) {
        String id = e.optString("id"), repo = e.optString("repo"), url = e.optString("url"), sha = e.optString("sha256");
        if (!id.matches("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+)+")) return "id";
        if (!repo.matches("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")) return "repo";
        if (!url.startsWith("https://github.com/" + repo + "/releases/download/") || !url.endsWith(".apk")) return "url";
        if (!sha.matches("[0-9a-f]{64}")) return "sha256";
        return null;
    }

    private JSONObject entry(String pkg) {
        JSONArray apps = catalog().optJSONArray("apps");
        if (apps == null) return null;
        for (int i = 0; i < apps.length(); i++) {
            JSONObject e = apps.optJSONObject(i);
            if (e != null && pkg.equals(e.optString("id")) && entryProblem(e) == null) return e;
        }
        return null;
    }

    private static String readText(InputStream in) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = i.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > 4 << 20) throw new IOException("too big"); }
            return out.toString("UTF-8");
        }
    }

    // MARK: - Installing an app

    /**
     * Installs (or updates) an app: from the Store's catalog when it has it (that exact APK: its SHA-256 is pinned in the catalog),
     * else, for a package in GITHUB, the newest android-tv release whose SHA256SUMS lists the APK. Only github.com downloads of that
     * app's project; nothing that does not match is installed. Android's installer asks the person (and, the first time, to allow
     * FreeTV to install apps).
     */
    private void install(final String pkg) {
        final JSONObject e = entry(pkg);
        final String repo = e != null ? e.optString("repo") : GITHUB.get(pkg);
        if (repo == null) { installState = "error:unknown"; return; }
        if (installState.startsWith("busy")) return;
        installState = "busy:download";
        new Thread(new Runnable() { public void run() {
            try {
                if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
                    installState = "permission";
                    Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try { activity.startActivity(i); } catch (Exception ignored) {}
                    return;
                }
                String apk, want;
                if (e != null) {
                    if (e.optInt("minSdk") > Build.VERSION.SDK_INT) throw new IOException("this TV's Android is too old for it");
                    apk = e.getString("url");
                    want = e.getString("sha256");
                } else {
                    String[] found = fromRelease(repo);
                    apk = found[0];
                    want = found[1];
                }
                File f = new File(activity.getCacheDir(), "install.apk");
                String got = download(apk, f);
                if (!got.equals(want)) { f.delete(); throw new IOException("SHA-256 does not match"); }
                installState = "busy:install";
                PackageInstaller pi = activity.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                sp.setAppPackageName(pkg);
                int id = pi.createSession(sp);
                try (PackageInstaller.Session session = pi.openSession(id)) {
                    try (InputStream in = new FileInputStream(f); OutputStream out = session.openWrite("app.apk", 0, f.length())) {
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                        session.fsync(out);
                    }
                    Intent done = new Intent(activity, InstallReceiver.class);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    session.commit(PendingIntent.getBroadcast(activity, id, done, flags).getIntentSender());
                }
                f.delete();
                installState = "asked";
            } catch (Exception ex) {
                AppLog.w("install " + pkg + ": " + ex);
                installState = "error:" + ex.getMessage();
            }
        }}, "freetv-install").start();
    }

    /** {APK address, its SHA-256} of the newest android-tv release of repo that publishes SHA256SUMS. */
    private static String[] fromRelease(String repo) throws Exception {
        JSONObject rel = null;
        JSONArray list = new JSONArray(get("https://api.github.com/repos/" + repo + "/releases?per_page=20"));
        for (int i = 0; i < list.length() && rel == null; i++) {
            JSONObject r = list.getJSONObject(i);
            if (!r.optBoolean("draft") && !r.optBoolean("prerelease") && r.optString("tag_name").startsWith("android-tv-v")) rel = r;
        }
        if (rel == null) throw new IOException("no Android TV release");
        JSONArray assets = rel.getJSONArray("assets");
        String apk = null, apkName = null, sums = null;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject a = assets.getJSONObject(i);
            String n = a.getString("name"), u = a.getString("browser_download_url");
            if (!u.startsWith("https://github.com/" + repo + "/releases/download/")) continue;
            if (n.endsWith(".apk")) { apk = u; apkName = n; } else if (n.equals("SHA256SUMS")) sums = u;
        }
        if (apk == null || sums == null) throw new IOException("the release has no APK and SHA256SUMS");
        String want = null;
        for (String line : get(sums).split("\n")) {
            String[] p = line.trim().split("\\s+\\*?");
            if (p.length == 2 && p[1].equals(apkName)) want = p[0].toLowerCase(Locale.ROOT);
        }
        if (want == null || !want.matches("[0-9a-f]{64}")) throw new IOException("no SHA-256 for " + apkName);
        return new String[] {apk, want};
    }

    /** Android's own "uninstall?" for an app of the Store (it asks the person). */
    private boolean uninstall(String pkg) {
        if (entry(pkg) == null && !GITHUB.containsKey(pkg)) return false;
        try {
            Intent i = new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(i);
            return true;
        } catch (Exception e) {
            AppLog.w("uninstall " + pkg + ": " + e);
            return false;
        }
    }

    private static String get(String url) throws IOException {
        HttpURLConnection c = open(url);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > 4 << 20) throw new IOException("too big"); }
            return out.toString("UTF-8");
        } finally { c.disconnect(); }
    }

    private static String download(String url, File to) throws Exception {
        HttpURLConnection c = open(url);
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(to)) {
            byte[] buf = new byte[65536];
            int n;
            long total = 0;
            while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); md.update(buf, 0, n); total += n; if (total > 200L << 20) throw new IOException("too big"); }
        } finally { c.disconnect(); }
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format(Locale.ROOT, "%02x", b));
        return sb.toString();
    }

    private static HttpURLConnection open(String url) throws IOException {
        URL u = new URL(url);
        if (!"https".equals(u.getProtocol())) throw new IOException("https only");
        HttpURLConnection c = (HttpURLConnection) u.openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "FreeTV (Android TV)");
        c.setRequestProperty("Accept", "application/vnd.github+json, */*");
        c.setInstanceFollowRedirects(true);
        int code = c.getResponseCode();
        if (code / 100 != 2) { c.disconnect(); throw new IOException("HTTP " + code); }
        return c;
    }

    // MARK: - window.FreeTVHost

    final class Host {
        /** [{id, title, icon, banner}]: every app the TV's launcher lists, FreeTV left out. */
        @JavascriptInterface public String apps() {
            JSONArray out = new JSONArray();
            PackageManager pm = activity.getPackageManager();
            String self = activity.getPackageName();
            for (String[] app : HomeApps.launchable(activity)) {
                if (app[0].equals(self)) continue;
                try {
                    JSONObject o = new JSONObject();
                    o.put("id", app[0]);
                    o.put("title", app[1]);
                    o.put("icon", ICON_HOST + Uri.encode(app[0]));
                    o.put("banner", hasBanner(pm, app[0]));
                    out.put(o);
                } catch (JSONException ignored) {}
            }
            return out.toString();
        }

        /** [{id, label, symbol, connected}]: Live TV (when the TV has a tuner app) and the HDMI inputs. */
        @JavascriptInterface public String inputs() {
            JSONArray out = new JSONArray();
            for (HomeApps.Item it : HomeApps.allInputs(activity)) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("id", it.kind == HomeApps.LIVE_TV ? "live" : "input:" + it.inputId);
                    o.put("label", it.label);
                    o.put("symbol", it.symbol);
                    o.put("connected", it.connected);
                    out.put(o);
                } catch (JSONException ignored) {}
            }
            return out.toString();
        }

        /** Opens an app (its package), "live", "input:<id>" or "settings"; true when Android took it. */
        @JavascriptInterface public boolean launch(String id, String uri) {
            final HomeApps.Item it;
            if ("settings".equals(id)) it = HomeApps.action(HomeApps.ANDROID_SETTINGS, "settings", "", "settings");
            else if ("live".equals(id)) it = HomeApps.action(HomeApps.LIVE_TV, "live", "", "tv");
            else if (id.startsWith("input:")) { it = HomeApps.action(HomeApps.INPUT, id, "", "hdmi"); it.inputId = id.substring(6); }
            else { it = HomeApps.app(id, id, uri == null || uri.isEmpty() ? null : uri); }
            final boolean[] ok = {false};
            final Object lock = new Object();
            ui.post(new Runnable() { public void run() {
                boolean r = HomeApps.open(activity, it, web, 0, 0, web.getWidth(), web.getHeight());
                synchronized (lock) { ok[0] = r; lock.notifyAll(); }
            }});
            synchronized (lock) { try { lock.wait(3000); } catch (InterruptedException ignored) {} }
            return ok[0];
        }

        /**
         * Opens Stremio Claude, on one title when type (movie|series) and an IMDb id are given, with FreeTV's TMDB key: the app writes
         * them where it reads them on webOS (open.json, tmdb.key; OriginActivity.fromFreeTV). Only those values are passed.
         */
        @JavascriptInterface public boolean openStremio(String type, String id, String key) {
            PackageManager pm = activity.getPackageManager();
            final Intent i = HomeApps.launchIntent(pm, STREMIO);
            if (i == null) return false;
            if (type != null && id != null && type.matches("movie|series") && id.matches("tt\\d{5,10}")) {
                i.putExtra("freetv.open.type", type);
                i.putExtra("freetv.open.id", id);
            }
            if (key != null && key.matches("[A-Za-z0-9._-]{16,400}")) i.putExtra("freetv.tmdb.key", key);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            final boolean[] ok = {false};
            final Object lock = new Object();
            ui.post(new Runnable() { public void run() {
                boolean r;
                try { activity.startActivity(i); r = true; } catch (Exception e) { AppLog.w("Stremio Claude: " + e); r = false; }
                synchronized (lock) { ok[0] = r; lock.notifyAll(); }
            }});
            synchronized (lock) { try { lock.wait(3000); } catch (InterruptedException ignored) {} }
            return ok[0];
        }

        @JavascriptInterface public boolean installed(String pkg) {
            try { activity.getPackageManager().getPackageInfo(pkg, 0); return true; } catch (PackageManager.NameNotFoundException e) { return false; }
        }

        /** The installed version of a package, or "". */
        @JavascriptInterface public String version(String pkg) {
            try { PackageInfo p = activity.getPackageManager().getPackageInfo(pkg, 0); return p.versionName != null ? p.versionName : ""; }
            catch (PackageManager.NameNotFoundException e) { return ""; }
        }

        /** Whether FreeTV can install this package from GitHub. */
        @JavascriptInterface public boolean canInstall(String pkg) { return GITHUB.containsKey(pkg) || entry(pkg) != null; }

        /**
         * The Store: [{id, title, desc: [pt, en, es], version, size, installed: versionName or ""}], from the newest catalog (fetched
         * again in the background when it is older than six hours; refresh: now).
         */
        @JavascriptInterface public String storeApps(boolean refresh) {
            refreshCatalog(refresh);
            JSONArray out = new JSONArray();
            JSONArray apps = catalog().optJSONArray("apps");
            PackageManager pm = activity.getPackageManager();
            for (int i = 0; apps != null && i < apps.length(); i++) {
                JSONObject e = apps.optJSONObject(i);
                if (e == null || entryProblem(e) != null) continue;
                try {
                    JSONObject o = new JSONObject();
                    o.put("id", e.getString("id"));
                    o.put("title", e.optString("title", e.getString("id")));
                    o.put("desc", e.optJSONArray("desc"));
                    o.put("version", e.optString("version"));
                    o.put("versionCode", e.optLong("versionCode"));
                    o.put("size", e.optLong("size"));
                    o.put("tooOld", e.optInt("minSdk") > Build.VERSION.SDK_INT);
                    String have = "";
                    long haveCode = 0;
                    try {
                        PackageInfo p = pm.getPackageInfo(e.getString("id"), 0);
                        have = p.versionName != null ? p.versionName : "?";
                        haveCode = Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
                    } catch (PackageManager.NameNotFoundException ignored) {}
                    o.put("installed", have);
                    o.put("installedCode", haveCode);
                    out.put(o);
                } catch (JSONException ignored) {}
            }
            return out.toString();
        }

        @JavascriptInterface public boolean uninstall(String pkg) { return WebHome.this.uninstall(pkg); }

        @JavascriptInterface public void install(String pkg) { WebHome.this.install(pkg); }

        /** "", "busy:download", "busy:install", "permission", "asked", "error:<why>". */
        @JavascriptInterface public String installState() { return installState; }

        @JavascriptInterface public String device() {
            return (Build.MANUFACTURER + " " + Build.MODEL + " (Android " + Build.VERSION.RELEASE + ")").trim();
        }

        @JavascriptInterface public String zone() { return java.util.TimeZone.getDefault().getID(); }

        @JavascriptInterface public String language() { return Locale.getDefault().toLanguageTag(); }
    }

    /** Android's answer to an install: it may need the person to confirm (an activity to start), or it is done. */
    public static final class InstallReceiver extends android.content.BroadcastReceiver {
        @Override public void onReceive(Context c, Intent i) {
            int status = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirm != null) {
                    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try { c.startActivity(confirm); } catch (Exception e) { AppLog.w("install confirm: " + e); }
                }
            } else if (status != PackageInstaller.STATUS_SUCCESS) {
                AppLog.w("install: " + i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE));
            }
        }
    }
}
