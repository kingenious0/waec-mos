package org.waec.mos.field.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.waec.mos.field.MainActivity;

/**
 * Foreground location service. The visible notification is intentional: field
 * officers can always see that duty tracking is on, and Android keeps the app
 * alive while they walk between examination halls.
 *
 * This service only streams raw fixes. Arrival tiers, dwell time and all HQ
 * flags stay in the shared TypeScript rules used by web and APK alike.
 */
public class FieldLocationService extends Service {

    private static final String CHANNEL_ID = "waec_field_location";
    private static final String PREFS = "waec_field_native";
    private static final int NOTIFICATION_ID = 4101;
    private static volatile boolean running = false;

    private LocationManager locationManager;
    private LocationListener locationListener;
    private long intervalMs = 10000;

    public static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            intervalMs = intent.getLongExtra("intervalMs", 10000);
            String title = intent.getStringExtra("notificationTitle");
            String text = intent.getStringExtra("notificationText");
            startForeground(NOTIFICATION_ID, buildNotification(
                title == null ? "WAEC field tracking" : title,
                text == null ? "Recording your location while you are on duty." : text
            ));
        } else {
            startForeground(NOTIFICATION_ID, buildNotification(
                "WAEC field tracking",
                "Recording your location while you are on duty."
            ));
        }

        startLocationUpdates();
        running = true;
        return START_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Field duty tracking",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shows while location is being recorded for duty evidence.");
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String title, String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openApp = PendingIntent.getActivity(this, 0, openIntent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setContentIntent(openApp)
            .build();
    }

    private void startLocationUpdates() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;

        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                publish(location);
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) { }

            @Override
            public void onProviderEnabled(String provider) { }

            @Override
            public void onProviderDisabled(String provider) { }
        };

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    intervalMs,
                    0f,
                    locationListener,
                    Looper.getMainLooper()
                );
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    intervalMs,
                    0f,
                    locationListener,
                    Looper.getMainLooper()
                );
            }

            Location last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last == null) {
                last = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            if (last != null) publish(last);
        } catch (SecurityException ignored) {
            // The plugin checks permission before starting; this is a harmless race.
        }
    }

    private void publish(Location location) {
        boolean mock = Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2
            && location.isFromMockProvider();

        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putLong("lat_bits", Double.doubleToLongBits(location.getLatitude()))
            .putLong("lng_bits", Double.doubleToLongBits(location.getLongitude()))
            .putLong("accuracy", Math.round(location.getAccuracy()))
            .putLong("timestamp", location.getTime())
            .putBoolean("mock", mock)
            .apply();

        FieldLocationPlugin.emitPosition(
            location.getLatitude(),
            location.getLongitude(),
            location.getAccuracy(),
            location.getTime(),
            mock
        );
    }

    @Override
    public void onDestroy() {
        if (locationManager != null && locationListener != null) {
            try {
                locationManager.removeUpdates(locationListener);
            } catch (SecurityException ignored) { }
        }
        running = false;
        stopForeground(true);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
