package com.plugin.filesaver

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import app.tauri.Logger
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.IOException

@InvokeArg
class SaveTextFileArgs {
  var fileName: String? = null
  var content: String? = null
  var mimeType: String? = null
}

@TauriPlugin
class FileSaverPlugin(private val activity: Activity) : Plugin(activity) {
    private data class PendingSave(
        val content: String,
    )

    private var pendingSave: PendingSave? = null

    @Command
    fun saveTextFile(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SaveTextFileArgs::class.java)
            val fileName = args.fileName?.trim()

            if (fileName.isNullOrEmpty()) {
                invoke.reject("fileName is required")
                return
            }

            if (pendingSave != null) {
                invoke.reject("Another save operation is already in progress")
                return
            }

            pendingSave = PendingSave(
                content = args.content ?: "",
            )

            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = args.mimeType?.takeIf { it.isNotBlank() } ?: "text/plain"
                putExtra(Intent.EXTRA_TITLE, fileName)
            }

            startActivityForResult(invoke, intent, "saveTextFileResult")
        } catch (ex: Exception) {
            pendingSave = null
            val message = ex.message ?: "Failed to open save dialog"
            Logger.error(message)
            invoke.reject(message)
        }
    }

    @ActivityCallback
    fun saveTextFileResult(invoke: Invoke, result: ActivityResult) {
        val save = pendingSave
        pendingSave = null

        if (save == null) {
            invoke.reject("No pending save operation")
            return
        }

        try {
            when (result.resultCode) {
                Activity.RESULT_OK -> {
                    val uri = result.data?.data ?: run {
                        invoke.reject("No destination was returned")
                        return
                    }

                    activity.contentResolver.openOutputStream(uri)?.use { stream ->
                        stream.write(save.content.toByteArray(Charsets.UTF_8))
                        stream.flush()
                    } ?: throw IOException("Failed to open destination for writing")

                    val response = JSObject()
                    response.put("uri", uri.toString())
                    invoke.resolve(response)
                }
                Activity.RESULT_CANCELED -> invoke.reject("Save cancelled")
                else -> invoke.reject("Failed to save file")
            }
        } catch (ex: Exception) {
            val message = ex.message ?: "Failed to write file"
            Logger.error(message)
            invoke.reject(message)
        }
    }
}
