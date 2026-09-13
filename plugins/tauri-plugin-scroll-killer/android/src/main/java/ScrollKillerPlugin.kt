package com.plugin.scrollkiller

import android.app.Activity
import android.view.View
import android.webkit.WebView
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Plugin

// WebView自体(ドキュメント全体)のスクロールを無効化する。
// iOS側の scrollView.isScrollEnabled = false に相当。
// DOM内部のoverflow要素のスクロールには影響しない。
@TauriPlugin
class ScrollKillerPlugin(private val activity: Activity) : Plugin(activity) {

    override fun load(webView: WebView) {
        super.load(webView)

        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false

        // input focus時のscrollIntoView等でドキュメントがずれた場合も即座に戻す
        webView.setOnScrollChangeListener { v, scrollX, scrollY, _, _ ->
            if (scrollX != 0 || scrollY != 0) {
                v.scrollTo(0, 0)
            }
        }
    }
}
