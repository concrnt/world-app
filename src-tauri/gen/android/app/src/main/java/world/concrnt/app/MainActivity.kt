package world.concrnt.app

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val wv = webView
        if (wv != null) {
          wv.evaluateJavascript(
            "(function() { return window.__concrntHandleBack ? window.__concrntHandleBack() : false; })()"
          ) { result ->
            if (result == "false" || result == "null" || result == "undefined") {
              finish()
            }
          }
        } else {
          finish()
        }
      }
    })
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    this.webView = webView
  }
}
