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
            // JS側の契約は「キーボードとwebview下端の重なり」(iOSはsafe area込みで送っている)。
            // MainActivityがenableEdgeToEdge()しているためwebviewはナビゲーションバーの裏まで
            // 画面下端いっぱいに広がっており、IMEインセット(ウィンドウ下端基準)がそのまま重なり量になる。
            // ここからナビゲーションバー分を引くと、その分だけ入力欄がキーボードに隠れる
            val heightPx = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom.coerceAtLeast(0)
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
