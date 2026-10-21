package io.github.virtuallocation;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Criteria;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Foreground service that registers test location providers and feeds them a
 * fixed point or a position moving along a route, once per second.
 *
 * Only works after the user picks this app under Developer options →
 * "Select mock location app".
 */
public class MockLocationService extends Service {
    public static final String ACTION_START = "io.github.virtuallocation.START";
    public static final String ACTION_STOP = "io.github.virtuallocation.STOP";
    public static final String EXTRA_LATS = "lats";
    public static final String EXTRA_LNGS = "lngs";
    public static final String EXTRA_SPEED_KMH = "speed_kmh";
    public static final String EXTRA_LOOP = "loop";

    /** Called on the main thread. */
    public interface Listener {
        void onMockState(boolean running, double lat, double lng, String status);

        /** {@code needsMockAppSetting} means this app isn't the selected mock location app. */
        void onMockError(String message, boolean needsMockAppSetting);
    }

    private static final long INTERVAL_MS = 1000;
    private static final int NOTIFICATION_ID = 1;
    private static final String CHANNEL_ID = "mock_location";

    private static Listener listener;
    private static boolean running;
    private static double currentLat;
    private static double currentLng;
    private static String currentStatus = "";

    public static void setListener(Listener l) {
        listener = l;
        if (l != null) {
            l.onMockState(running, currentLat, currentLng, currentStatus);
        }
    }

    public static boolean isRunning() {
        return running;
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<String> providers = new ArrayList<>();
    private LocationManager locationManager;
    private FusedLocationProviderClient fusedClient;
    private boolean fusedMockEnabled;

    private Route route;
    private double speedMps;
    private boolean loop;
    private long startedAt;
    private int ticks;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (!running) {
                return;
            }
            pushLocation();
            handler.postDelayed(this, INTERVAL_MS);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_START.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        double[] lats = intent.getDoubleArrayExtra(EXTRA_LATS);
        double[] lngs = intent.getDoubleArrayExtra(EXTRA_LNGS);
        if (lats == null || lngs == null || lats.length == 0 || lats.length != lngs.length) {
            stopSelf();
            return START_NOT_STICKY;
        }
        loop = intent.getBooleanExtra(EXTRA_LOOP, false);
        speedMps = intent.getDoubleExtra(EXTRA_SPEED_KMH, 5) / 3.6;
        route = new Route(lats, lngs, loop);

        try {
            startInForeground(lats[0], lngs[0]);
        } catch (RuntimeException e) {
            // Android 14+ refuses a location foreground service without location permission.
            fail("无法启动前台服务，请授予定位权限：" + e.getMessage(), false);
            return START_NOT_STICKY;
        }

        if (providers.isEmpty()) {
            try {
                setUpProviders();
            } catch (SecurityException e) {
                fail("本应用未被选为模拟位置应用", true);
                return START_NOT_STICKY;
            }
        }

        startedAt = SystemClock.elapsedRealtime();
        ticks = 0;
        running = true;
        handler.removeCallbacks(tick);
        handler.post(tick);
        // Redeliver so a restart after the system kills the service resumes the same route.
        return START_REDELIVER_INTENT;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(tick);
        tearDownProviders();
        running = false;
        currentStatus = "已停止";
        if (listener != null) {
            listener.onMockState(false, currentLat, currentLng, currentStatus);
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void setUpProviders() {
        List<String> names = new ArrayList<>();
        names.add(LocationManager.GPS_PROVIDER);
        names.add(LocationManager.NETWORK_PROVIDER);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            names.add(LocationManager.FUSED_PROVIDER);
        }
        for (String name : names) {
            try {
                locationManager.removeTestProvider(name);
            } catch (IllegalArgumentException ignored) {
                // Not registered yet.
            }
            try {
                locationManager.addTestProvider(name, false, false, false, false,
                        true, true, true, Criteria.POWER_LOW, Criteria.ACCURACY_FINE);
                locationManager.setTestProviderEnabled(name, true);
                providers.add(name);
            } catch (IllegalArgumentException e) {
                // Some ROMs reject a provider name; the others still work.
            }
        }
        enableFusedMock();
    }

    @SuppressLint("MissingPermission")
    private void enableFusedMock() {
        try {
            fusedClient = LocationServices.getFusedLocationProviderClient(this);
            fusedClient.setMockMode(true)
                    .addOnSuccessListener(v -> fusedMockEnabled = true)
                    .addOnFailureListener(e -> fusedMockEnabled = false);
        } catch (RuntimeException e) {
            // No Google Play services on this device: system providers still work.
            fusedClient = null;
        }
    }

    @SuppressLint("MissingPermission")
    private void tearDownProviders() {
        for (String name : providers) {
            try {
                locationManager.setTestProviderEnabled(name, false);
                locationManager.removeTestProvider(name);
            } catch (RuntimeException ignored) {
                // Mock app setting was revoked or provider already gone.
            }
        }
        providers.clear();
        if (fusedClient != null) {
            try {
                fusedClient.setMockMode(false);
            } catch (RuntimeException ignored) {
                // Nothing to undo.
            }
            fusedClient = null;
            fusedMockEnabled = false;
        }
    }

    @SuppressLint("MissingPermission")
    private void pushLocation() {
        double elapsedSec = (SystemClock.elapsedRealtime() - startedAt) / 1000.0;
        double traveled = speedMps * elapsedSec;
        boolean moving = !route.isSinglePoint() && speedMps > 0;
        boolean arrived = false;
        if (moving) {
            if (loop) {
                traveled %= route.length();
            } else if (traveled >= route.length()) {
                arrived = true;
            }
        }
        double[] p = route.sample(moving ? traveled : 0);
        currentLat = p[0];
        currentLng = p[1];
        float speed = moving && !arrived ? (float) speedMps : 0f;

        for (String name : providers) {
            try {
                locationManager.setTestProviderLocation(name, buildLocation(name, p, speed));
            } catch (SecurityException e) {
                fail("模拟位置权限已被撤销", true);
                return;
            } catch (IllegalArgumentException ignored) {
                // Provider removed by the system; skip it.
            }
        }
        if (fusedClient != null && fusedMockEnabled) {
            try {
                fusedClient.setMockLocation(buildLocation("fused", p, speed));
            } catch (RuntimeException ignored) {
                // Play services rejected it; system providers still have the location.
            }
        }

        if (moving && !arrived) {
            currentStatus = String.format(Locale.US, "路线模拟中 %.0f / %.0f 米，%.1f km/h",
                    traveled, route.length(), speedMps * 3.6);
        } else if (arrived) {
            currentStatus = "已到达终点，停留在此";
        } else {
            currentStatus = "定点模拟中";
        }
        if (listener != null) {
            listener.onMockState(true, currentLat, currentLng, currentStatus);
        }
        if (moving && ticks % 5 == 0) {
            getSystemService(NotificationManager.class)
                    .notify(NOTIFICATION_ID, buildNotification(currentLat, currentLng));
        }
        ticks++;
    }

    private static Location buildLocation(String provider, double[] p, float speed) {
        Location loc = new Location(provider);
        loc.setLatitude(p[0]);
        loc.setLongitude(p[1]);
        loc.setAltitude(50);
        loc.setAccuracy(3f);
        loc.setVerticalAccuracyMeters(5f);
        loc.setSpeed(speed);
        loc.setSpeedAccuracyMetersPerSecond(0.5f);
        loc.setBearing((float) p[2]);
        loc.setBearingAccuracyDegrees(5f);
        loc.setTime(System.currentTimeMillis());
        loc.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
        return loc;
    }

    private void fail(String message, boolean needsMockAppSetting) {
        running = false;
        handler.removeCallbacks(tick);
        if (listener != null) {
            listener.onMockError(message, needsMockAppSetting);
        }
        stopSelf();
    }

    private void startInForeground(double lat, double lng) {
        Notification n = buildNotification(lat, lng);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
    }

    private Notification buildNotification(double lat, double lng) {
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1,
                new Intent(this, MockLocationService.class).setAction(ACTION_STOP),
                PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(getString(R.string.app_name) + " 运行中")
                .setContentText(String.format(Locale.US, "%.6f, %.6f", lat, lng))
                .setContentIntent(open)
                .addAction(new Notification.Action.Builder(null, getString(R.string.stop), stop).build())
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                getString(R.string.notification_channel), NotificationManager.IMPORTANCE_LOW);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
}
