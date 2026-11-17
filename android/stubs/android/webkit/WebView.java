package android.webkit;
public class WebView extends android.view.View {
    public WebView(android.content.Context c) {}
    public WebSettings getSettings() { return null; }
    public void setWebViewClient(WebViewClient c) {}
    public void loadUrl(String url) {}
    public void onPause() {}
    public void onResume() {}
    public boolean canGoBack() { return false; }
    public void goBack() {}
}
