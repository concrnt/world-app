package world.concrnt.plugin.push

import android.util.Base64
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives concrnt's WebPush notifications relayed through webpush-relay as
 * FCM data-only messages (see webpush-relay/README.md for the payload
 * contract: data["p"] = base64url(no padding) of the raw aes128gcm WebPush
 * body, data["e"] = "aes128gcm"). Data-only (no `notification` field) so this
 * fires even while the app is backgrounded or killed.
 */
class ConcrntMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Defensive: do the network+crypto work off whatever thread FCM calls
        // us on, since notification enrichment does blocking network I/O.
        Thread {
            try {
                handle(remoteMessage)
            } catch (e: Exception) {
                Log.e(TAG, "failed to handle push message", e)
                NotificationRenderer.show(applicationContext, null)
            }
        }.start()
    }

    private fun handle(remoteMessage: RemoteMessage) {
        val encoding = remoteMessage.data["e"]
        val encoded = remoteMessage.data["p"]

        if (encoding != "aes128gcm" || encoded.isNullOrEmpty()) {
            // Relay sent a size-fallback or unknown-encoding message; show a
            // generic notification rather than silently dropping it.
            Log.w(TAG, "no aes128gcm payload (relay size-fallback or unknown encoding) -> generic notification")
            NotificationRenderer.show(applicationContext, null)
            return
        }

        val body = Base64.decode(encoded, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        val keys = PushKeyStore.getOrCreateKeys(applicationContext)

        val decrypted = try {
            PushCrypto.decrypt(body, keys.privateKey, keys.publicKeyBytes, keys.auth)
        } catch (e: Exception) {
            Log.e(TAG, "failed to decrypt push message", e)
            null
        }

        NotificationRenderer.show(applicationContext, decrypted)
    }

    override fun onNewToken(token: String) {
        PushKeyStore.saveFcmToken(applicationContext, token)
    }

    companion object {
        private const val TAG = "ConcrntMessagingService"
    }
}
