package world.concrnt.plugin.translation

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import java.util.Locale

@InvokeArg
class DetectArgs {
    var text: String? = null
}

@InvokeArg
class TranslateArgs {
    var text: String? = null
    var targetLanguage: String? = null
}

// ML Kit On-device Translation + Language ID。モデル(~30MB/言語)は初回翻訳時にアプリ領域へDLされる。
// Play services の Task リスナーはメインスレッドで呼ばれるので runOnUiThread は不要
@TauriPlugin
class TranslationPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun isAvailable(invoke: Invoke) {
        invoke.resolve(JSObject().apply { put("available", true) })
    }

    @Command
    fun detectLanguage(invoke: Invoke) {
        val args = invoke.parseArgs(DetectArgs::class.java)
        val text = args.text?.takeIf { it.isNotBlank() }
        if (text == null) {
            invoke.resolve(JSObject().apply { put("language", null) })
            return
        }
        val identifier = LanguageIdentification.getClient()
        identifier.identifyLanguage(text)
            .addOnCompleteListener { identifier.close() }
            .addOnSuccessListener { tag ->
                invoke.resolve(JSObject().apply { put("language", if (tag == "und") null else tag) })
            }
            .addOnFailureListener { e ->
                invoke.reject("failed: " + (e.message ?: "language identification failed"))
            }
    }

    @Command
    fun translate(invoke: Invoke) {
        val args = invoke.parseArgs(TranslateArgs::class.java)
        val text = args.text?.takeIf { it.isNotBlank() }
        if (text == null) {
            invoke.reject("failed: text is required")
            return
        }
        val target = args.targetLanguage?.let { toTranslateLanguage(it) }
        if (target == null) {
            invoke.reject("unsupported: target language")
            return
        }

        val identifier = LanguageIdentification.getClient()
        identifier.identifyLanguage(text)
            .addOnCompleteListener { identifier.close() }
            .addOnFailureListener { e ->
                invoke.reject("failed: " + (e.message ?: "language identification failed"))
            }
            .addOnSuccessListener { tag ->
                if (tag == "und") {
                    invoke.reject("undetermined")
                    return@addOnSuccessListener
                }
                val source = toTranslateLanguage(tag)
                if (source == null) {
                    invoke.reject("unsupported: source language $tag")
                    return@addOnSuccessListener
                }
                if (source == target) {
                    invoke.resolve(result(text, source, target))
                    return@addOnSuccessListener
                }

                val translator = Translation.getClient(
                    TranslatorOptions.Builder()
                        .setSourceLanguage(source)
                        .setTargetLanguage(target)
                        .build()
                )
                // ユーザーが翻訳ボタンを押した起点なので Wi-Fi 制限はかけない
                translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
                    .onSuccessTask { translator.translate(text) }
                    .addOnCompleteListener { translator.close() }
                    .addOnSuccessListener { translated -> invoke.resolve(result(translated, source, target)) }
                    .addOnFailureListener { e ->
                        invoke.reject("failed: " + (e.message ?: "translation failed"))
                    }
            }
    }

    private fun result(text: String, source: String, target: String): JSObject = JSObject().apply {
        put("text", text)
        put("sourceLanguage", source)
        put("targetLanguage", target)
        put("engine", "mlkit")
    }

    // Language ID は "ja-Latn" のようにスクリプト付きで返すことがあるが、Translate は基底コードしか知らない
    private fun toTranslateLanguage(tag: String): String? =
        TranslateLanguage.fromLanguageTag(tag)
            ?: TranslateLanguage.fromLanguageTag(Locale.forLanguageTag(tag).language)
}
