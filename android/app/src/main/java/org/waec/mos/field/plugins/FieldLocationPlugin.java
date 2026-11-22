package org.waec.mos.field.plugins;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Native capability bridge for field duty evidence.
 *
 * The web app owns all arrival/departure rules. This plugin only does what a
 * browser cannot: keep a foreground location service alive while the officer
 * is moving between exam halls, and report device-integrity signals honestly.
 */
@CapacitorPlugin(
    name = "FieldLocation",
    permissions = {
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION }
        ),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class FieldLocationPlugin extends Plugin {

    private static final String TAG = "FieldLocation";
    private static final String PREFS = "waec_field_native";
    private static volatile FieldLocationPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    /** Called by the foreground service for every GPS fix, including fixes while backgrounded. */
    static void emitPosition(double lat, double lng, float accuracy, long timeMs, boolean mock) {
        FieldLocationPlugin plugin = instance;
        if (plugin == null) return;

        JSObject data = new JSObject();
        data.put("latitude", lat);
        data.put("longitude", lng);
        data.put("accuracy", Math.round(accuracy));
        data.put("timestamp", timeMs);
        data.put("mock", mock);
        plugin.notifyListeners("position", data, false);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!PermissionState.GRANTED.equals(getPermissionState("location"))) {
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }
        startServiceInternal(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (!PermissionState.GRANTED.equals(getPermissionState("location"))) {
            call.reject(
                "LOCATION_PERMISSION_DENIED",
                "Location permission is needed to record duty arrival. Enable it in phone settings."
            );
            return;
        }
        // Android 13+: the persistent tracking notification needs opt-in. Never block duty tracking on it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && !PermissionState.GRANTED.equals(getPermissionState("notifications"))) {
            requestPermissionForAlias("notifications", call, "notificationsPermissionCallback");
            return;
        }
        startServiceInternal(call);
    }

    @PermissionCallback
    private void notificationsPermissionCallback(PluginCall call) {
        startServiceInternal(call);
    }

    private void startServiceInternal(PluginCall call) {
        Intent intent = new Intent(getContext(), FieldLocationService.class);
        intent.putExtra("intervalMs", call.getInt("intervalMs", 10000));
        intent.putExtra(
            "notificationTitle",
            call.getString("notificationTitle", "WAEC field tracking")
        );
        intent.putExtra(
            "notificationText",
            call.getString("notificationText", "Recording your location while you are on duty.")
        );
        getContext().startForegroundService(intent);

        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), FieldLocationService.class));
        JSObject result = new JSObject();
        result.put("started", false);
        call.resolve(result);
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", FieldLocationService.isRunning());
        call.resolve(result);
    }

    /** Last fix is kept on disk so a page reload can show where the officer is immediately. */
    @PluginMethod
    public void getLastKnown(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        if (prefs.contains("lat_bits")) {
            result.put(
                "latitude",
                Double.longBitsToDouble(prefs.getLong("lat_bits", Double.doubleToLongBits(0)))
            );
            result.put(
                "longitude",
                Double.longBitsToDouble(prefs.getLong("lng_bits", Double.doubleToLongBits(0)))
            );
            result.put("accuracy", prefs.getLong("accuracy", 0));
            result.put("timestamp", prefs.getLong("timestamp", 0));
            result.put("mock", prefs.getBoolean("mock", false));
        }
        call.resolve(result);
    }

    /**
     * Device-local integrity signals. This is deliberately NOT Play Integrity:
     * a real Play Integrity verdict needs a Google Cloud project and a server
     * token check. These signals are shown to HQ as advice, never as proof.
     */
    @PluginMethod
    public void getIntegrity(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        try {
            result.put(
                "mockLocationSetting",
                Settings.Secure.getInt(context.getContentResolver(), "mock_location", 0) == 1
            );
        } catch (Throwable ignored) {
            result.put("mockLocationSetting", false);
        }
        result.put(
            "adbEnabled",
            Settings.Global.getInt(context.getContentResolver(), Settings.Global.ADB_ENABLED, 0) == 1
        );
        result.put(
            "developerOptions",
            Settings.Global.getInt(
                context.getContentResolver(),
                Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                0
            ) == 1
        );
        result.put("rooted", isRooted());
        result.put("emulator", isEmulator());
        result.put("testKeys", Build.TAGS != null && Build.TAGS.contains("test-keys"));
        result.put("provider", "device-local");
        result.put("evaluatedAt", System.currentTimeMillis());
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        result.put("lastFixMock", prefs.getBoolean("mock", false));
        call.resolve(result);
    }

    private static boolean isRooted() {
        String[] paths = {
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su"
        };
        for (String path : paths) {
            if (new java.io.File(path).exists()) return true;
        }
        return false;
    }

    private static boolean isEmulator() {
        String fingerprint = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT.toLowerCase();
        String model = Build.MODEL == null ? "" : Build.MODEL.toLowerCase();
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();
        return fingerprint.startsWith("generic")
            || fingerprint.contains("vbox")
            || fingerprint.contains("generic")
            || model.contains("emulator")
            || model.contains("android sdk")
            || manufacturer.contains("genymotion");
    }
}
