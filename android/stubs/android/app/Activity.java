package android.app;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
public class Activity extends android.content.Context {
    protected void onCreate(Bundle b) {}
    protected void onPause() {}
    protected void onResume() {}
    public void onWindowFocusChanged(boolean f) {}
    public void onBackPressed() {}
    public final boolean requestWindowFeature(int id) { return true; }
    public Window getWindow() { return null; }
    public void setContentView(View v) {}
}
