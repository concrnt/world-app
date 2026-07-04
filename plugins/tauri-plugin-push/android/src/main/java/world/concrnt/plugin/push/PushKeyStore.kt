package world.concrnt.plugin.push

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Base64
import app.tauri.plugin.JSObject
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.spec.ECGenParameterSpec
import java.security.interfaces.ECPrivateKey
import java.security.interfaces.ECPublicKey

/**
 * Persists the on-device WebPush keypair (P-256 + 16-byte auth secret), the
 * "self" account context, and the buffered cold-start deep link. Storage is a
 * plain app-private SharedPreferences file: EncryptedSharedPreferences is in
 * maintenance mode and AndroidKeyStore-backed ECDH key agreement requires API
 * 31+, which is above this app's minSdk (24). Revisit if/when minSdk rises.
 */
object PushKeyStore {
    private const val PREFS_NAME = "world.concrnt.plugin.push"

    private const val KEY_PRIVATE = "ec_private"
    private const val KEY_PUBLIC = "ec_public"
    private const val KEY_AUTH = "auth_secret"
    private const val KEY_HOME_DOMAIN = "home_domain"
    private const val KEY_CCID = "ccid"
    private const val KEY_FCM_TOKEN = "fcm_token"
    private const val KEY_LAUNCH_URI = "launch_uri"
    private const val KEY_LAUNCH_VIEW = "launch_view"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    data class Keys(val privateKey: ECPrivateKey, val publicKeyBytes: ByteArray, val auth: ByteArray)

    /** Returns the existing keypair/auth secret, generating and persisting one on first call. */
    @Synchronized
    fun getOrCreateKeys(context: Context): Keys {
        val p = prefs(context)
        val existingPriv = p.getString(KEY_PRIVATE, null)
        val existingPub = p.getString(KEY_PUBLIC, null)
        val existingAuth = p.getString(KEY_AUTH, null)

        if (existingPriv != null && existingPub != null && existingAuth != null) {
            val privBytes = Base64.decode(existingPriv, Base64.NO_WRAP)
            val pubBytes = Base64.decode(existingPub, Base64.NO_WRAP)
            val authBytes = Base64.decode(existingAuth, Base64.NO_WRAP)
            return Keys(PushCrypto.decodePrivateKeyRaw(privBytes), pubBytes, authBytes)
        }

        val generator = KeyPairGenerator.getInstance("EC")
        generator.initialize(ECGenParameterSpec("secp256r1"))
        val pair = generator.generateKeyPair()
        val privateKey = pair.private as ECPrivateKey
        val publicKey = pair.public as ECPublicKey
        val publicKeyBytes = PushCrypto.encodeUncompressedP256(publicKey)
        val privateKeyRaw = PushCrypto.encodePrivateKeyRaw(privateKey)

        val auth = ByteArray(16)
        SecureRandom().nextBytes(auth)

        p.edit()
            .putString(KEY_PRIVATE, Base64.encodeToString(privateKeyRaw, Base64.NO_WRAP))
            .putString(KEY_PUBLIC, Base64.encodeToString(publicKeyBytes, Base64.NO_WRAP))
            .putString(KEY_AUTH, Base64.encodeToString(auth, Base64.NO_WRAP))
            .apply()

        return Keys(privateKey, publicKeyBytes, auth)
    }

    fun resetKeys(context: Context) {
        prefs(context).edit()
            .remove(KEY_PRIVATE)
            .remove(KEY_PUBLIC)
            .remove(KEY_AUTH)
            .apply()
    }

    fun setContext(context: Context, homeDomain: String?, ccid: String?) {
        prefs(context).edit()
            .putString(KEY_HOME_DOMAIN, homeDomain)
            .putString(KEY_CCID, ccid)
            .apply()
    }

    fun getHomeDomain(context: Context): String? = prefs(context).getString(KEY_HOME_DOMAIN, null)

    fun getCcid(context: Context): String? = prefs(context).getString(KEY_CCID, null)

    fun saveFcmToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_FCM_TOKEN, token).apply()
    }

    fun getFcmToken(context: Context): String? = prefs(context).getString(KEY_FCM_TOKEN, null)

    /** Buffers a deep link so a cold-started app can retrieve it once the webview is ready. */
    fun bufferLaunch(context: Context, uri: String?, view: String?) {
        prefs(context).edit()
            .putString(KEY_LAUNCH_URI, uri)
            .putString(KEY_LAUNCH_VIEW, view)
            .apply()
    }

    /** Reads and clears the buffered launch deep link. */
    fun consumeLaunch(context: Context): JSObject {
        val p = prefs(context)
        val uri = p.getString(KEY_LAUNCH_URI, null)
        val view = p.getString(KEY_LAUNCH_VIEW, null)
        p.edit().remove(KEY_LAUNCH_URI).remove(KEY_LAUNCH_VIEW).apply()
        return JSObject().apply {
            put("uri", uri)
            put("view", view)
        }
    }

    /** Extracts the "cc-deeplink"/"cc-view" extras a notification tap launches MainActivity with. */
    fun extractDeepLink(intent: Intent?): JSObject? {
        val uri = intent?.getStringExtra("cc-deeplink") ?: return null
        return JSObject().apply {
            put("uri", uri)
            put("view", intent.getStringExtra("cc-view") ?: "post")
        }
    }
}
