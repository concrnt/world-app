package com.plugin.share

import android.app.Activity
import android.content.Intent
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class ShareTextArgs {
    var text: String? = null
    var title: String? = null
}

@TauriPlugin
class SharePlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun shareText(invoke: Invoke) {
        val args = invoke.parseArgs(ShareTextArgs::class.java)
        val text = args.text
        if (text.isNullOrEmpty()) {
            invoke.reject("text is required")
            return
        }

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            args.title?.takeIf { it.isNotBlank() }?.let { putExtra(Intent.EXTRA_SUBJECT, it) }
        }

        activity.runOnUiThread {
            try {
                activity.startActivity(Intent.createChooser(intent, args.title))
                invoke.resolve()
            } catch (ex: Exception) {
                invoke.reject(ex.message ?: "Failed to open share sheet")
            }
        }
    }
}
