package org.waec.mos.field;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import org.waec.mos.field.plugins.FieldLocationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register BEFORE super.onCreate(). BridgeActivity.onCreate() creates the
        // Bridge and injects window.Capacitor.Plugins into the WebView. A plugin
        // registered afterwards is never exposed to JavaScript, so every native
        // call rejects before the app can ask for location permission.
        registerPlugin(FieldLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
