package ch.ulmipoint.wunschportal;

import android.app.Activity;
import android.app.PendingIntent;
import android.os.Bundle;
import android.os.Build;
import android.net.Uri;
import android.content.Intent;
import android.graphics.Color;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String START_URL = "https://liv-dienstplaner.vercel.app/wunschportal.html?app=apk";
    private WebView webView;
    private NfcAdapter nfcAdapter;
    private PendingIntent nfcPendingIntent;
    private String lastNfcId = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(Color.WHITE);
        setContentView(webView);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " ULMIPOINT-Wunschportal-APK NFC-Test");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String host = url.getHost() == null ? "" : url.getHost().toLowerCase();
                if (host.equals("liv-dienstplaner.vercel.app") || host.endsWith("supabase.co") || host.equals("github.com")) return false;
                openExternal(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectNfcPanel();
                if (nfcAdapter == null) {
                    updateNfcPanel("", "Dieses Handy meldet kein NFC.", nowText());
                } else if (!nfcAdapter.isEnabled()) {
                    updateNfcPanel("", "NFC ist ausgeschaltet. Bitte in Android aktivieren.", nowText());
                } else {
                    updateNfcPanel(lastNfcId, lastNfcId.length() > 0 ? "Letzter Patch erkannt." : "Bereit. Arbeits-Patch ans Handy halten.", nowText());
                }
            }
        });

        webView.setDownloadListener((DownloadListener) (url, userAgent, contentDisposition, mimetype, contentLength) ->
                openExternal(Uri.parse(url)));

        setupNfc();

        if (savedInstanceState == null) webView.loadUrl(START_URL);
        else webView.restoreState(savedInstanceState);

        handleNfcIntent(getIntent());
    }

    private void setupNfc() {
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);
        if (nfcAdapter == null) return;

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;

        Intent intent = new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        nfcPendingIntent = PendingIntent.getActivity(this, 0, intent, flags);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (nfcAdapter != null && nfcPendingIntent != null) {
            nfcAdapter.enableForegroundDispatch(this, nfcPendingIntent, null, null);
        }
    }

    @Override
    protected void onPause() {
        if (nfcAdapter != null) {
            try { nfcAdapter.disableForegroundDispatch(this); } catch (Exception ignored) {}
        }
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNfcIntent(intent);
    }

    private void handleNfcIntent(Intent intent) {
        if (intent == null) return;
        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        if (tag == null) return;

        lastNfcId = bytesToHex(tag.getId());
        Toast.makeText(this, "Patch erkannt: " + lastNfcId, Toast.LENGTH_LONG).show();
        updateNfcPanel(lastNfcId, "Patch erkannt. NFC-Test erfolgreich.", nowText());
    }

    private String bytesToHex(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02X", b));
        return sb.toString();
    }

    private String nowText() {
        return new SimpleDateFormat("dd.MM.yyyy HH:mm:ss", Locale.GERMAN).format(new Date());
    }

    private void injectNfcPanel() {
        if (webView == null) return;

        String js = "(function(){"
                + "if(document.getElementById('ulmiNfcStampCard'))return;"
                + "var css=document.createElement('style');"
                + "css.textContent='#ulmiNfcStampCard{margin:10px 10px 12px;padding:14px;border:1px solid #c9dcff;border-radius:20px;background:linear-gradient(135deg,#f7fbff,#ffffff);box-shadow:0 10px 26px rgba(16,24,40,.07);font-family:inherit;color:#172033}#ulmiNfcStampCard h2{margin:0 0 6px;font-size:22px;letter-spacing:-.04em}#ulmiNfcStampCard .nfcMini{font-size:12px;color:#667085;font-weight:850;line-height:1.35}#ulmiNfcStampCard .nfcBox{margin-top:10px;padding:10px;border-radius:14px;background:#eef7ff;border:1px solid #bcd3ff;color:#175cd3;font-size:13px;font-weight:900;word-break:break-all}#ulmiNfcStampCard .nfcId{font-family:ui-monospace,Menlo,monospace;font-size:14px;color:#111827}#ulmiNfcStampCard .nfcPills{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}#ulmiNfcStampCard .nfcPill{border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;background:#e7f7ef;color:#0f8a5f}@media(min-width:821px){#ulmiNfcStampCard{display:none}}';"
                + "document.head.appendChild(css);"
                + "var card=document.createElement('section');"
                + "card.id='ulmiNfcStampCard';"
                + "card.innerHTML='<h2>🟦 NFC-Stempeln testen</h2><div class=\"nfcMini\">Nur in der Android-App sichtbar. Arbeits-Patch ans Handy halten.</div><div class=\"nfcBox\"><div>Status: <span id=\"ulmiNfcStatus\">Bereit</span></div><div style=\"margin-top:6px\">NFC-ID: <span class=\"nfcId\" id=\"ulmiNfcId\">noch kein Patch erkannt</span></div><div class=\"nfcMini\" style=\"margin-top:6px\">Zeit: <span id=\"ulmiNfcTime\">-</span></div></div><div class=\"nfcPills\"><span class=\"nfcPill\">Testmodus</span><span class=\"nfcPill\">noch keine echte Stempelung</span></div>';"
                + "var nav=document.querySelector('.quick-tabs');"
                + "if(nav&&nav.parentNode){nav.parentNode.insertBefore(card,nav.nextSibling);}else{document.body.insertBefore(card,document.body.firstChild);}"
                + "window.ULMI_NFC_UPDATE=function(id,status,time){"
                + "var s=document.getElementById('ulmiNfcStatus');if(s)s.textContent=status||'';"
                + "var i=document.getElementById('ulmiNfcId');if(i)i.textContent=id||'noch kein Patch erkannt';"
                + "var t=document.getElementById('ulmiNfcTime');if(t)t.textContent=time||'';"
                + "};"
                + "})();";

        webView.evaluateJavascript(js, null);
    }

    private void updateNfcPanel(String id, String status, String time) {
        if (webView == null) return;
        final String js = "window.ULMI_NFC_UPDATE && window.ULMI_NFC_UPDATE("
                + JSONObject.quote(id == null ? "" : id) + ","
                + JSONObject.quote(status == null ? "" : status) + ","
                + JSONObject.quote(time == null ? "" : time) + ");";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void openExternal(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
