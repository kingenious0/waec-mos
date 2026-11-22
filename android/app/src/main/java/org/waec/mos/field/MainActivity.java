package org.waec.mos.field;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import org.waec.mos.field.plugins.FieldLocationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(FieldLocationPlugin.class);
    }
}
