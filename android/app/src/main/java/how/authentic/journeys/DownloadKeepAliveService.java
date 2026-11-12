package how.authentic.journeys;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

/**
 * A dataSync foreground service whose only job is to keep this process (and
 * the WebView running the download loop) alive after the reader leaves the
 * app or locks the screen. The JavaScript side still does the fetching.
 *
 * A full NASB is 1,189 chapter requests against a 200-request-per-hour
 * YouVersion limit, so a download can run for about six hours with long
 * Retry-After waits. Android 15 caps a dataSync service at six hours in a
 * 24-hour window; {@link #onTimeout(int)} stops the service cleanly so the
 * app does not crash when that budget is spent.
 */
public class DownloadKeepAliveService extends Service {
    public static final String ACTION_START = "how.authentic.journeys.DOWNLOAD_KEEP_ALIVE_START";
    public static final String ACTION_UPDATE = "how.authentic.journeys.DOWNLOAD_KEEP_ALIVE_UPDATE";
    public static final String ACTION_STOP = "how.authentic.journeys.DOWNLOAD_KEEP_ALIVE_STOP";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String CHANNEL_ID = "bible-downloads";
    public static final int NOTIFICATION_ID = 1001;
    /** Slightly longer than a typical full-NASB run, so a missed stop cannot leak the lock forever. */
    private static final long WAKE_LOCK_MS = 7L * 60L * 60L * 1000L;
    private static final long KEEP_AWAKE_MS = 30_000L;

    private static volatile boolean running = false;
    private static String lastTitle = "Downloading";
    private static String lastBody = "";

    private PowerManager.WakeLock wakeLock;
    private final Handler heartbeat = new Handler(Looper.getMainLooper());
    private final Runnable keepAwake = new Runnable() {
        @Override
        public void run() {
            DownloadKeepAlivePlugin.keepWebViewAwake();
            heartbeat.postDelayed(this, KEEP_AWAKE_MS);
        }
    };

    public static boolean isRunning() {
        return running;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopForegroundAndSelf();
            return START_NOT_STICKY;
        }
        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        if (title != null) lastTitle = title;
        if (body != null) lastBody = body;
        ensureChannel();
        Notification notification = buildNotification(lastTitle, lastBody);
        if (ACTION_UPDATE.equals(intent.getAction())) {
            // Updates arrive through startService(): just re-post the notification.
            // Never promote to foreground from here (that can be refused in the background).
            if (running) {
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) manager.notify(NOTIFICATION_ID, notification);
            } else {
                stopSelf(startId);
            }
            return START_NOT_STICKY;
        }
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (RuntimeException e) {
            // e.g. ForegroundServiceStartNotAllowedException: run without keep-alive.
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        running = true;
        acquireWakeLock();
        heartbeat.removeCallbacks(keepAwake);
        heartbeat.post(keepAwake);
        DownloadKeepAlivePlugin.keepWebViewAwake();
        return START_NOT_STICKY;
    }

    @Override
    public void onTimeout(int startId) {
        // Android 15: dataSync foreground services are limited to six hours.
        // Chapters already fetched are on disk; ask the reader to reopen and resume.
        postPausedNotification();
        stopForegroundAndSelf();
    }

    @Override
    public void onTimeout(int startId, int fgsType) {
        postPausedNotification();
        stopForegroundAndSelf();
    }

    @Override
    public void onDestroy() {
        heartbeat.removeCallbacks(keepAwake);
        releaseWakeLock();
        running = false;
        super.onDestroy();
    }

    private void stopForegroundAndSelf() {
        heartbeat.removeCallbacks(keepAwake);
        releaseWakeLock();
        running = false;
        if (Build.VERSION.SDK_INT >= 24) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "journeys:bible-download");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(WAKE_LOCK_MS);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Bible downloads",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Progress while a Bible is downloading in the background.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String title, String body) {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = null;
        if (launch != null) {
            launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            content = PendingIntent.getActivity(this, 0, launch, flags);
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.ic_stat_download)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        if (content != null) builder.setContentIntent(content);
        return builder.build();
    }

    private void postPausedNotification() {
        ensureChannel();
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = null;
        if (launch != null) {
            launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            content = PendingIntent.getActivity(this, 1, launch, flags);
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Journeys")
            .setContentText("Bible download paused. Open Journeys to continue.")
            .setSmallIcon(R.drawable.ic_stat_download)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        if (content != null) builder.setContentIntent(content);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID + 1, builder.build());
    }
}
