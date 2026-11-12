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
        // WebView methods must run on the main thread; plugin calls arrive on
        // Capacitor's background thread, and calling from there kills the app.
        Runnable resume = () -> {
            webView.onResume();
            webView.resumeTimers();
        };
        if (Looper.myLooper() == Looper.getMainLooper()) {
            resume.run();
        } else {
            new Handler(Looper.getMainLooper()).post(resume);
        }
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
        if (DownloadKeepAliveService.isRunning()) {
            Intent intent = new Intent(getContext(), DownloadKeepAliveService.class);
            intent.setAction(DownloadKeepAliveService.ACTION_STOP);
            try {
                getContext().startService(intent);
            } catch (RuntimeException ignored) {
                // Nothing to stop if the system refuses the intent.
            }
        }
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
        boolean update = DownloadKeepAliveService.ACTION_UPDATE.equals(action);
        try {
            if (update) {
                // Every startForegroundService() call obliges the service to call
                // startForeground() within a few seconds, or Android kills the app.
                // Progress updates only re-post the notification, so they go through
                // plain startService(), and only while the service is already running.
                if (DownloadKeepAliveService.isRunning()) {
                    getContext().startService(intent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (RuntimeException ignored) {
            // Keep-alive is best effort (e.g. a start refused while in the background);
            // the download itself keeps running in the WebView.
        }
    }
}
