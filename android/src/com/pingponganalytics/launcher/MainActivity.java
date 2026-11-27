package com.pingponganalytics.launcher;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final Uri APP_URL = Uri.parse("https://ping-pong-ping-pong3.vercel.app/");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent browser = new Intent(Intent.ACTION_VIEW, APP_URL);
        browser.addCategory(Intent.CATEGORY_BROWSABLE);

        // Browsers that support Custom Tabs can show the web app in a compact tab.
        // Other browsers can still handle the same standard web intent.
        Bundle options = new Bundle();
        options.putBinder("android.support.customtabs.extra.SESSION", null);
        options.putInt("android.support.customtabs.extra.TOOLBAR_COLOR", Color.rgb(13, 21, 36));
        browser.putExtras(options);
        try {
            startActivity(browser);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, R.string.browser_required, Toast.LENGTH_LONG).show();
        } finally {
            finish();
        }
    }
}
