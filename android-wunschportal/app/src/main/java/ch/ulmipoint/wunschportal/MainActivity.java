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
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.Locale;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

public class MainActivity extends Activity {
    private static final String START_URL = "https://liv-dienstplaner.vercel.app/wunschportal.html?app=apk";
    private static final String APK_URL = "https://github.com/ulmiulmi/liv-dienstplaner/releases/latest/download/ulmipoint-wunschportal.apk";

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
        settings.setUserAgentString(settings.getUserAgentString() + " ULMIPOINT-Wunschportal-APK TimeClockCamera");

        webView.addJavascriptInterface(new NativeBridge(), "ULMI_NATIVE");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String host = url.getHost() == null ? "" : url.getHost().toLowerCase();

                if (host.equals("liv-dienstplaner.vercel.app") || host.endsWith("supabase.co") || host.equals("github.com")) {
                    return false;
                }

                openExternal(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                polishAppHeader();
                injectTimeClockPanel();

                Uri uri = Uri.parse(url);
                String stamp = uri.getQueryParameter("stamp");
                if (stamp != null && stamp.trim().length() > 0) {
                    emitNativeStamp("qr-link", stamp);
                }

                if (nfcAdapter == null) {
                    updateNativeStatus("Dieses Handy meldet kein NFC. QR-Kamera funktioniert trotzdem.");
                } else if (!nfcAdapter.isEnabled()) {
                    updateNativeStatus("NFC ist ausgeschaltet. QR-Kamera funktioniert trotzdem.");
                } else {
                    updateNativeStatus(lastNfcId.length() > 0 ? "Letzter NFC-Tag erkannt." : "Bereit. QR scannen oder NFC-Tag ans Handy halten.");
                }
            }
        });

        webView.setDownloadListener((DownloadListener) (url, userAgent, contentDisposition, mimetype, contentLength) ->
                openExternal(Uri.parse(url)));

        setupNfc();

        if (savedInstanceState == null) {
            String initialUrl = START_URL;
            Uri incoming = getIntent() == null ? null : getIntent().getData();
            if (incoming != null && "liv-dienstplaner.vercel.app".equalsIgnoreCase(incoming.getHost())) {
                initialUrl = ensureAppMode(incoming.toString());
            }
            webView.loadUrl(initialUrl);
        } else {
            webView.restoreState(savedInstanceState);
        }

        handleNfcIntent(getIntent());
    }

    private String ensureAppMode(String url) {
        if (url == null || url.length() == 0) return START_URL;
        return url.contains("app=apk") ? url : url + (url.contains("?") ? "&" : "?") + "app=apk";
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

        Uri incoming = intent == null ? null : intent.getData();
        if (incoming != null && webView != null) {
            webView.loadUrl(ensureAppMode(incoming.toString()));
        }

        handleNfcIntent(intent);
    }

    private void handleNfcIntent(Intent intent) {
        if (intent == null) return;
        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        if (tag == null) return;

        lastNfcId = bytesToHex(tag.getId());
        Toast.makeText(this, "NFC-Tag erkannt: " + lastNfcId, Toast.LENGTH_LONG).show();
        emitNativeStamp("nfc", lastNfcId);
    }

    private String bytesToHex(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02X", b));
        return sb.toString();
    }

    private void startQrScanNative() {
        try {
            GmsBarcodeScannerOptions options =
                    new GmsBarcodeScannerOptions.Builder()
                            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                            .enableAutoZoom()
                            .build();

            GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(this, options);
            scanner.startScan()
                    .addOnSuccessListener(barcode -> {
                        String raw = barcode.getRawValue();
                        if (raw == null || raw.trim().length() == 0) {
                            updateNativeStatus("QR-Code gelesen, aber ohne Inhalt.");
                            return;
                        }
                        emitNativeStamp("qr", raw);
                    })
                    .addOnCanceledListener(() -> updateNativeStatus("QR-Scan abgebrochen."))
                    .addOnFailureListener(e -> updateNativeStatus("QR-Scan Fehler: " + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage())));
        } catch (Exception e) {
            updateNativeStatus("QR-Scanner konnte nicht geöffnet werden: " + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
        }
    }

    private void polishAppHeader() {
        if (webView == null) return;

        String js = "(function(){"
                + "var links=document.querySelectorAll('a.apk-download');"
                + "links.forEach(function(a){"
                + "a.textContent='🔄 Nach Update suchen';"
                + "a.setAttribute('aria-label','Nach Update suchen');"
                + "a.title='Neueste App-Version herunterladen';"
                + "});"
                + "})();";

        webView.evaluateJavascript(js, null);
    }

    private void injectTimeClockPanel() {
        if (webView == null) return;

        String js = "(function(){"
                + "if(document.getElementById('ulmiTimeClockCard'))return;"
                + "var css=document.createElement('style');"
                + "css.textContent='#ulmiTimeClockCard{margin:10px 10px 12px;padding:14px;border:1px solid #c9dcff;border-radius:20px;background:linear-gradient(135deg,#f7fbff,#ffffff);box-shadow:0 10px 26px rgba(16,24,40,.07);font-family:inherit;color:#172033}#ulmiTimeClockCard h2{margin:0 0 6px;font-size:22px;letter-spacing:-.04em}#ulmiTimeClockCard .tcMini{font-size:12px;color:#667085;font-weight:850;line-height:1.35}#ulmiTimeClockCard .tcBox{margin-top:10px;padding:10px;border-radius:14px;background:#eef7ff;border:1px solid #bcd3ff;color:#175cd3;font-size:13px;font-weight:900;word-break:break-word}#ulmiTimeClockCard .tcActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#ulmiTimeClockCard button{border:1px solid #c9dcff;background:#eaf2ff;color:#175cd3;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:950}#ulmiTimeClockCard button.primary{background:#2563eb;color:#fff;border-color:#2563eb}@media(min-width:821px){#ulmiTimeClockCard{display:none}}';"
                + "document.head.appendChild(css);"
                + "var card=document.createElement('section');"
                + "card.id='ulmiTimeClockCard';"
                + "card.innerHTML='<h2>⏱️ QR/NFC-Stempeln</h2><div class=\"tcMini\">QR direkt mit Kamera scannen. Eigene NFC-Tags bleiben offen.</div><div class=\"tcActions\"><button class=\"primary\" type=\"button\" id=\"ulmiQrScanBtn\">📷 QR scannen</button><button type=\"button\" id=\"ulmiRefreshClockBtn\">Letzte Erfassung laden</button></div><div class=\"tcBox\"><div>Status: <span id=\"ulmiTcStatus\">Bereit</span></div><div style=\"margin-top:6px\">Letzte Erfassung: <span id=\"ulmiTcLast\">-</span></div><div class=\"tcMini\" style=\"margin-top:6px\">Quelle: <span id=\"ulmiTcSource\">QR / NFC / API offen</span></div></div>';"
                + "var nav=document.querySelector('.quick-tabs');"
                + "if(nav&&nav.parentNode){nav.parentNode.insertBefore(card,nav.nextSibling);}else{document.body.insertBefore(card,document.body.firstChild);}"
                + "function readSession(){try{var s=JSON.parse(localStorage.getItem('polypoint_wunschportal_session_v1')||'{}');return s||{};}catch(e){return {};}}"
                + "function loginPayload(){var s=readSession();var ident=s.identity||(s.user&&s.user.email)||s.employeeName||(document.getElementById('codeIdentity')||{}).value||'';var code=s.wishCode||(document.getElementById('codePin')||{}).value||'';return {identity:ident,wishCode:code};}"
                + "function setTc(status,last,source){var a=document.getElementById('ulmiTcStatus');if(a)a.textContent=status||'';var b=document.getElementById('ulmiTcLast');if(b)b.textContent=last||'-';var c=document.getElementById('ulmiTcSource');if(c)c.textContent=source||'';}"
                + "function stamp(source,raw){var lp=loginPayload();if(!lp.identity||!lp.wishCode){setTc('Bitte zuerst im Wunschportal einloggen.','-','');return;}setTc('Stempel wird gespeichert …',raw,source);fetch('/api/time-clock-stamp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:lp.identity,code:lp.wishCode,source:source,token:raw,raw:raw,action:'auto',client:'android-app',apiMode:'prepared'})}).then(function(r){return r.text().then(function(t){var d={};try{d=t?JSON.parse(t):{};}catch(e){d={message:t};}if(!r.ok||d.ok===false)throw new Error(d.message||('HTTP '+r.status));return d;});}).then(function(d){var e=d.event||{};setTc((e.actionLabel||e.action||'gespeichert')+' gespeichert',(e.employeeName||'')+' · '+(e.locationLabel||e.locationId||'Ort')+' · '+(e.timeText||e.at||''),source+' · API: '+((e.api&&e.api.status)||'open'));}).catch(function(e){setTc('Fehler: '+e.message,raw,source);});}"
                + "window.ULMI_TIME_FROM_NATIVE=function(source,raw){stamp(source,raw);};"
                + "window.ULMI_TIME_STATUS=function(status){setTc(status,document.getElementById('ulmiTcLast')?.textContent||'-',document.getElementById('ulmiTcSource')?.textContent||'');};"
                + "document.getElementById('ulmiQrScanBtn').onclick=function(){if(window.ULMI_NATIVE&&window.ULMI_NATIVE.startQrScan){window.ULMI_NATIVE.startQrScan();}else{setTc('QR-Kamera nur in der Android-App verfügbar.','-','');}};"
                + "document.getElementById('ulmiRefreshClockBtn').onclick=function(){var lp=loginPayload();if(!lp.identity||!lp.wishCode){setTc('Bitte zuerst einloggen.','-','');return;}fetch('/api/time-clock-list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:lp.identity,code:lp.wishCode,mode:'self',limit:1})}).then(function(r){return r.json();}).then(function(d){var e=(d.events||[])[0];if(!e){setTc('Noch keine Erfassung.','-','');return;}setTc('Letzte Erfassung geladen',(e.employeeName||'')+' · '+(e.actionLabel||e.action)+' · '+(e.locationLabel||e.locationId||'')+' · '+(e.timeText||e.at),e.source+' · API: '+((e.api&&e.api.status)||'open'));}).catch(function(e){setTc('Fehler: '+e.message,'-','');});};"
                + "setTc('Bereit. QR scannen oder NFC-Tag ans Handy halten.','-','QR / NFC');"
                + "})();";

        webView.evaluateJavascript(js, null);
    }

    private void emitNativeStamp(String source, String raw) {
        if (webView == null) return;
        final String js = "window.ULMI_TIME_FROM_NATIVE && window.ULMI_TIME_FROM_NATIVE("
                + JSONObject.quote(source == null ? "" : source) + ","
                + JSONObject.quote(raw == null ? "" : raw) + ");";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void updateNativeStatus(String status) {
        if (webView == null) return;
        final String js = "window.ULMI_TIME_STATUS && window.ULMI_TIME_STATUS("
                + JSONObject.quote(status == null ? "" : status) + ");";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    public class NativeBridge {
        @JavascriptInterface
        public void startQrScan() {
            runOnUiThread(() -> startQrScanNative());
        }

        @JavascriptInterface
        public void openUpdate() {
            runOnUiThread(() -> openExternal(Uri.parse(APK_URL)));
        }
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
