package how.authentic.journeys;

import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;

/**
 * JS bridge for {@link DownloadKeepAliveService}, plus a native sleep that is
 * not subject to WebView timer throttling, and a hook that resumes the
 * WebView when the activity is paused so the download loop keeps running.
 */
@CapacitorPlugin(name = "DownloadKeepAlive")
public class DownloadKeepAlivePlugin extends Plugin {
    private static WeakReference<DownloadKeepAlivePlugin> instance = new WeakReference<>(null);

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    public static void keepWebViewAwake() {
        DownloadKeepAlivePlugin plugin = instance.get();
        if (plugin == null || plugin.getBridge() == null) return;
        WebView webView = plugin.getBridge().getWebView();
        if (webView == null) return;
        webView.onResume();
        webView.resumeTimers();
    }

    @Override
    protected void handleOnPause() {
        if (DownloadKeepAliveService.isRunning()) {
            keepWebViewAwake();
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        startOrUpdate(call, DownloadKeepAliveService.ACTION_START);
        keepWebViewAwake();
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        startOrUpdate(call, DownloadKeepAliveService.ACTION_UPDATE);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), DownloadKeepAliveService.class);
        intent.setAction(DownloadKeepAliveService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void sleep(PluginCall call) {
        Long ms = call.getLong("ms");
        long delay = ms == null ? 0L : Math.max(0L, ms);
        if (delay <= 0L) {
            call.resolve();
            return;
        }
        new Handler(Looper.getMainLooper()).postDelayed(call::resolve, delay);
    }

    private void startOrUpdate(PluginCall call, String action) {
        Intent intent = new Intent(getContext(), DownloadKeepAliveService.class);
        intent.setAction(action);
        intent.putExtra(DownloadKeepAliveService.EXTRA_TITLE, call.getString("title", "Downloading"));
        intent.putExtra(DownloadKeepAliveService.EXTRA_BODY, call.getString("body", ""));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
    }
}
