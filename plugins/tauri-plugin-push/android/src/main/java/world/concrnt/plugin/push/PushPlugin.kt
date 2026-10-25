package world.concrnt.plugin.push

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import android.webkit.WebView
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.firebase.messaging.FirebaseMessaging

private const val PERMISSION_ALIAS = "postNotification"

@InvokeArg
class SetBadgeArgs {
    var count: Int = 0
}

@InvokeArg
class SetContextArgs {
    var homeDomain: String? = null
    var ccid: String? = null
}

@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = PERMISSION_ALIAS)
    ]
)
class PushPlugin(private val activity: Activity) : Plugin(activity) {

    // Contract with the JS (app/src/lib/push.ts): a tap is always written to
    // the persistent buffer first and then signalled with `notificationTapped`.
    // The buffer is the source of truth; the event payload is only a wake-up.
    // JS drains the buffer on MainView mount AND on every signal, so a warm tap
    // is consumed immediately and never left on disk to be replayed later.

    override fun load(webView: WebView) {
        NotificationRenderer.ensureChannel(activity)
        // `activity.intent` is the task's launch intent and is re-delivered
        // when the Activity is recreated after process death, so only buffer a
        // tap we have not seen yet (NotificationRenderer stamps each tap intent
        // with a unique id). Intents without an id (pre-upgrade notifications)
        // are buffered as before.
        val data = PushKeyStore.extractDeepLink(activity.intent) ?: return
        val tapId = data.getString("tapId", null)
        if (tapId != null && tapId == PushKeyStore.lastTapId(activity)) return
        PushKeyStore.bufferLaunch(activity, data.getString("uri"), data.getString("view"), tapId)
    }

    override fun onNewIntent(intent: Intent) {
        val data = PushKeyStore.extractDeepLink(intent) ?: return
        PushKeyStore.bufferLaunch(activity, data.getString("uri"), data.getString("view"), data.getString("tapId", null))
        trigger("notificationTapped", data)
    }

    @Command
    fun checkPermission(invoke: Invoke) {
        invoke.resolve(JSObject().apply { put("status", currentPermissionStatus()) })
    }

    @Command
    fun requestPermission(invoke: Invoke) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            invoke.resolve(JSObject().apply { put("granted", true) })
            return
        }
        requestPermissionForAlias(PERMISSION_ALIAS, invoke, "handlePermissionResult")
    }

    @PermissionCallback
    fun handlePermissionResult(invoke: Invoke) {
        val granted = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        invoke.resolve(JSObject().apply { put("granted", granted) })
    }

    private fun currentPermissionStatus(): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted"
        return if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) "granted" else "prompt"
    }

    @Command
    fun getToken(invoke: Invoke) {
        // FirebaseMessaging.getInstance() throws when the app was built without
        // google-services.json (no default FirebaseApp) — reject instead of crashing.
        val messaging = try {
            FirebaseMessaging.getInstance()
        } catch (e: Exception) {
            invoke.reject("push notifications unavailable: " + (e.message ?: "Firebase is not configured"))
            return
        }
        messaging.token
            .addOnSuccessListener { token ->
                PushKeyStore.saveFcmToken(activity, token)
                invoke.resolve(JSObject().apply {
                    put("platform", "fcm")
                    put("token", token)
                    put("environment", "production")
                })
            }
            .addOnFailureListener { e -> invoke.reject(e.message ?: "failed to get FCM token") }
    }

    @Command
    fun getOrCreateKeys(invoke: Invoke) {
        try {
            val keys = PushKeyStore.getOrCreateKeys(activity)
            invoke.resolve(JSObject().apply {
                put("p256dh", Base64.encodeToString(keys.publicKeyBytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP))
                put("auth", Base64.encodeToString(keys.auth, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP))
            })
        } catch (e: Exception) {
            invoke.reject(e.message ?: "failed to generate keys")
        }
    }

    @Command
    fun resetKeys(invoke: Invoke) {
        PushKeyStore.resetKeys(activity)
        invoke.resolve()
    }

    @Command
    fun setContext(invoke: Invoke) {
        val args = invoke.parseArgs(SetContextArgs::class.java)
        PushKeyStore.setContext(activity, args.homeDomain, args.ccid)
        invoke.resolve()
    }

    @Command
    fun getLaunchNotification(invoke: Invoke) {
        invoke.resolve(PushKeyStore.consumeLaunch(activity))
    }

    /**
     * Android has no public app-icon badge API; the launcher dot/number follows
     * posted notifications (each carries the count via setNumber). So 0 clears
     * the posted notifications and any other value is a no-op.
     */
    @Command
    fun setBadge(invoke: Invoke) {
        val args = invoke.parseArgs(SetBadgeArgs::class.java)
        if (args.count == 0) {
            val manager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancelAll()
        }
        invoke.resolve()
    }
}
