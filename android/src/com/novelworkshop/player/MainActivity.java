package com.novelworkshop.player;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 노벨 공방 게임 플레이어: 앱 안에 들어 있는 assets/game.html 을 화면 가득 보여줘요.
 * 저장 슬롯(localStorage)은 앱 안에 그대로 남아요.
 */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(1);                 // Window.FEATURE_NO_TITLE
        getWindow().setFlags(0x480, 0x480);      // FLAG_FULLSCREEN | FLAG_KEEP_SCREEN_ON
        web = new WebView(this);
        web.setBackgroundColor(0xff000000);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        setContentView(web);
        hideBars();
        web.loadUrl("file:///android_asset/game.html");
    }

    private void hideBars() {
        // LAYOUT_STABLE | LAYOUT_HIDE_NAVIGATION | LAYOUT_FULLSCREEN | HIDE_NAVIGATION | FULLSCREEN | IMMERSIVE_STICKY
        web.setSystemUiVisibility(0x1706);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && web != null) hideBars();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
