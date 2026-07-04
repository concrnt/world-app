package com.plugin.keyboard

import android.app.Activity
import android.view.View
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class KeyboardPlugin(private val activity: Activity) : Plugin(activity) {

    override fun load(webView: WebView) {
        super.load(webView)

        val density = activity.resources.displayMetrics.density
        val content = activity.findViewById<View>(android.R.id.content)

        ViewCompat.setOnApplyWindowInsetsListener(content) { _, insets ->
            // IMEインセットはナビゲーションバー領域を含むので差し引く
            val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
            val navBottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
            val heightPx = (imeBottom - navBottom).coerceAtLeast(0)
            val visible = insets.isVisible(WindowInsetsCompat.Type.ime()) && heightPx > 0

            val payload = JSObject().apply {
                put("visible", visible)
                // 物理px -> CSS px
                put("height", (heightPx / density).toDouble())
                put("duration", 0)
            }
            trigger("keyboardChange", payload)

            insets
        }
    }
}
