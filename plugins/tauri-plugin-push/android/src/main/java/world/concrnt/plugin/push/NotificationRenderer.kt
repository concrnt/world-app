package world.concrnt.plugin.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.graphics.drawable.IconCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Parses a decrypted concrnt push payload and shows a system notification.
 * Mirrors the per-schema Japanese copy from the v1 web client's service worker
 * (references/concrnt-world/app/src/sw.js). The push carries only the minimal
 * notification struct {uri, schema, author, createdAt} (see concrnt's
 * NotificationReactor.buildNotificationPayload); this resolves the association
 * document the uri points at (GET /api/v2/resolve) to recover value/associate,
 * then resolves the actor's profile and the target message body on demand.
 */
object NotificationRenderer {
    private const val TAG = "NotificationRenderer"
    private const val CHANNEL_ID = "concrnt-notifications"
    private const val FETCH_TIMEOUT_MS = 3000
    private const val FALLBACK_TITLE = "新しい通知があります"

    // Tints the small icon's badge in the notification shade (concrnt brand blue).
    private val ACCENT_COLOR = android.graphics.Color.parseColor("#0476d9")

    private const val SCHEMA_LIKE = "https://schema.concrnt.world/a/like.json"
    private const val SCHEMA_REACTION = "https://schema.concrnt.world/a/reaction.json"
    private const val SCHEMA_REROUTE = "https://schema.concrnt.world/a/reroute.json"
    private const val SCHEMA_REPLY = "https://schema.concrnt.world/a/reply.json"
    private const val SCHEMA_MENTION = "https://schema.concrnt.world/a/mention.json"
    private const val SCHEMA_READ_ACCESS_REQUEST = "https://schema.concrnt.world/a/readaccessrequest.json"
    private const val SCHEMA_FOLLOW_ACK = "https://schema.concrnt.world/ack/follow.json"

    private data class Content(
        val title: String,
        val body: String?,
        val targetUri: String?,
        val view: String,
        val largeIcon: Bitmap? = null,
        // When set, overrides the default concrnt status-bar icon (used to show
        // a reaction emoji as an alpha silhouette badge, v1-style).
        val smallIcon: IconCompat? = null
    )

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(CHANNEL_ID, "通知", NotificationManager.IMPORTANCE_HIGH)
        manager.createNotificationChannel(channel)
    }

    /** Builds and shows a notification. `decrypted` is null if decryption failed. */
    fun show(context: Context, decrypted: ByteArray?) {
        val content = decrypted
            ?.let {
                val json = String(it, Charsets.UTF_8)
                // Surface an otherwise-swallowed buildContent failure so a
                // generic-fallback notification can be traced to a cause. Note
                // the payload itself is not logged (it carries notification
                // content).
                runCatching { buildContent(context, json) }
                    .onFailure { e -> Log.e(TAG, "buildContent threw", e) }
                    .getOrNull()
                    .also { c -> if (c == null) Log.w(TAG, "buildContent produced no content -> generic fallback") }
            }
            ?: Content(FALLBACK_TITLE, null, null, "notifications")

        display(context, content)
    }

    private fun buildContent(context: Context, payloadJson: String): Content? {
        // The push carries only the minimal notification struct
        // {uri, schema, author, createdAt}; everything else is fetched from the
        // association document the uri points at. See webpush-relay/README and
        // concrnt's NotificationReactor.buildNotificationPayload.
        val payload = JSONObject(payloadJson)
        val uri = payload.optString("uri", "").takeIf { it.isNotEmpty() } ?: return null

        val homeDomain = PushKeyStore.getHomeDomain(context) ?: return null

        // Resolve the association document (ccfs://...) the push refers to.
        val doc = fetchResolvedDocument(homeDomain, uri) ?: return null

        // schema/author come pre-resolved in the payload; fall back to the
        // resolved document if the server omitted them.
        val schema = payload.optString("schema", "").takeIf { it.isNotEmpty() } ?: doc.optString("schema", "")
        val author = payload.optString("author", "").takeIf { it.isNotEmpty() } ?: doc.optString("author", "")

        val value = doc.optJSONObject("value") ?: JSONObject()
        val profileOverride = value.optJSONObject("profileOverride")
        val overrideUsername = profileOverride?.optString("username", "")?.takeIf { it.isNotEmpty() }
        val overrideAvatar = profileOverride?.optString("avatar", "")?.takeIf { it.isNotEmpty() }
        val profileId = profileOverride?.optString("profileID", "")?.takeIf { it.isNotEmpty() }

        // Resolve the actor's profile once for both the display name and avatar.
        val actor = resolveActorProfile(homeDomain, author, profileId)
        val username = overrideUsername ?: actor?.username ?: "名無し"

        // The notification's large icon is always the actor's avatar.
        val avatarUrl = overrideAvatar ?: actor?.avatar
        val avatarIcon = avatarUrl?.let { fetchBitmap(it) }

        val associate = doc.optString("associate", "").takeIf { it.isNotEmpty() }

        val content = when (schema) {
            SCHEMA_LIKE -> Content(
                "${username}さんがあなたの投稿にいいねしました",
                associate?.let { resolveMessageBody(homeDomain, it) },
                associate,
                "post"
            )
            SCHEMA_REACTION -> {
                // Mirror the v1 web client: the reaction emoji becomes the
                // status-bar badge (sw.js set it as `badge`). Android renders a
                // small-icon bitmap as an alpha silhouette, so we binarize the
                // emoji's alpha into a monochrome badge. value.imageUrl is a full
                // URL in v2.
                val imageUrl = value.optString("imageUrl", "").takeIf { it.isNotEmpty() }
                Content(
                    "${username}さんがあなたの投稿にリアクションしました :${value.optString("shortcode", "")}:",
                    associate?.let { resolveMessageBody(homeDomain, it) },
                    associate,
                    "post",
                    smallIcon = imageUrl?.let { fetchBadgeIcon(it) }
                )
            }
            SCHEMA_REROUTE -> Content(
                "${username}さんがあなたの投稿をリルートしました",
                associate?.let { resolveMessageBody(homeDomain, it) },
                associate,
                "post"
            )
            SCHEMA_REPLY -> {
                val target = value.optString("targetURI", "").takeIf { it.isNotEmpty() } ?: associate
                Content(
                    "${username}さんがあなたの投稿にリプライしました",
                    target?.let { resolveMessageBody(homeDomain, it) },
                    target,
                    "post"
                )
            }
            SCHEMA_MENTION -> Content(
                "${username}さんがあなたをメンションしました",
                associate?.let { resolveMessageBody(homeDomain, it) },
                associate,
                "post"
            )
            SCHEMA_READ_ACCESS_REQUEST -> Content("${username}さんが閲覧リクエストを送信しています", null, null, "notifications")
            SCHEMA_FOLLOW_ACK -> Content("${username}さんにフォローされました", null, null, "notifications")
            else -> Content(FALLBACK_TITLE, null, null, "notifications")
        }

        // Always attach the actor's avatar as the large icon.
        return content.copy(largeIcon = avatarIcon)
    }

    private data class ActorProfile(val username: String?, val avatar: String?)

    /** Resolves the actor's display name and avatar URL via a resolve() round trip. */
    private fun resolveActorProfile(homeDomain: String, author: String, profileId: String?): ActorProfile? {
        if (author.isEmpty()) return null
        val authorDomain = resolveAuthorDomain(homeDomain, author) ?: return null
        val profile = profileId ?: "main"
        val uri = "cckv://$author/concrnt.world/profiles/$profile"
        val profileDoc = fetchResolvedDocument(authorDomain, uri) ?: return null
        val v = profileDoc.optJSONObject("value")
        return ActorProfile(
            v?.optString("username", "")?.takeIf { it.isNotEmpty() },
            v?.optString("avatar", "")?.takeIf { it.isNotEmpty() }
        )
    }

    private fun resolveAuthorDomain(homeDomain: String, author: String): String? {
        val entityDoc = fetchResolvedDocument(homeDomain, "cckv://$author") ?: return null
        return entityDoc.optJSONObject("value")?.optString("domain", "")?.takeIf { it.isNotEmpty() }
    }

    private fun resolveMessageBody(homeDomain: String, targetUri: String): String? {
        val doc = fetchResolvedDocument(homeDomain, targetUri) ?: return null
        val body = doc.optJSONObject("value")?.optString("body", "")?.takeIf { it.isNotEmpty() } ?: return null
        return if (body.length > 140) body.substring(0, 140) else body
    }

    /** GET /api/v2/resolve?uri=... — returns the raw SignedDocument, then double-parses `.document`. */
    private fun fetchResolvedDocument(domain: String, uri: String): JSONObject? {
        val encoded = URLEncoder.encode(uri, "UTF-8")
        val body = fetchJson("https://$domain/api/v2/resolve?uri=$encoded") ?: return null
        val docStr = body.optString("document", "").takeIf { it.isNotEmpty() } ?: return null
        return runCatching { JSONObject(docStr) }.getOrNull()
    }

    private fun fetchJson(urlStr: String): JSONObject? {
        return try {
            val connection = URL(urlStr).openConnection() as HttpURLConnection
            connection.connectTimeout = FETCH_TIMEOUT_MS
            connection.readTimeout = FETCH_TIMEOUT_MS
            connection.setRequestProperty("Accept", "application/json")
            connection.requestMethod = "GET"
            connection.inputStream.bufferedReader().use { reader ->
                if (connection.responseCode != 200) return null
                JSONObject(reader.readText())
            }
        } catch (e: Exception) {
            null
        }
    }

    /** Downloads an image (e.g. an avatar) to use as the notification's large icon. Best-effort. */
    private fun fetchBitmap(urlStr: String): Bitmap? {
        return try {
            val connection = URL(urlStr).openConnection() as HttpURLConnection
            connection.connectTimeout = FETCH_TIMEOUT_MS
            connection.readTimeout = FETCH_TIMEOUT_MS
            connection.requestMethod = "GET"
            connection.inputStream.use { stream ->
                if (connection.responseCode != 200) return null
                BitmapFactory.decodeStream(stream)
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Builds a status-bar badge icon from a reaction emoji image. Android
     * renders a small-icon bitmap monochrome via its alpha channel, so this
     * binarizes the emoji's alpha into a clean white-on-transparent silhouette
     * (matching how the v1 web client's `badge` looked). Best-effort.
     */
    private fun fetchBadgeIcon(urlStr: String): IconCompat? {
        val src = fetchBitmap(urlStr) ?: return null
        return runCatching { IconCompat.createWithBitmap(alphaSilhouette(src)) }.getOrNull()
    }

    private fun alphaSilhouette(src: Bitmap): Bitmap {
        val width = src.width
        val height = src.height
        val pixels = IntArray(width * height)
        src.getPixels(pixels, 0, width, 0, 0, width, height)
        for (i in pixels.indices) {
            val alpha = (pixels[i] ushr 24) and 0xff
            // Binarize on alpha: opaque pixels become white, the rest transparent.
            pixels[i] = if (alpha >= 128) -0x1 else 0 // -0x1 == 0xFFFFFFFF (opaque white)
        }
        val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        out.setPixels(pixels, 0, width, 0, 0, width, height)
        return out
    }

    private fun display(context: Context, content: Content) {
        ensureChannel(context)

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val intent = Intent(launchIntent).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("cc-deeplink", content.targetUri)
            putExtra("cc-view", content.view)
        }
        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, pendingIntentFlags)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .apply {
                val badge = content.smallIcon
                if (badge != null) setSmallIcon(badge) else setSmallIcon(smallIconId(context))
            }
            .setColor(ACCENT_COLOR)
            .setContentTitle(content.title)
            .apply { content.body?.let { setContentText(it) } }
            .apply { content.largeIcon?.let { setLargeIcon(it) } }
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .apply { content.targetUri?.let { setGroup(it) } }
            .build()

        val notificationId = (content.targetUri ?: content.title).hashCode()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }

    /**
     * The notification status-bar icon. A small icon must be a monochrome
     * silhouette (Android reads only its alpha); the full-colour launcher icon
     * collapses to a blank circle. Resolve the dedicated drawable by name so
     * this plugin module doesn't depend on the app's generated R class, falling
     * back to the launcher icon if the app hasn't shipped one.
     */
    private fun smallIconId(context: Context): Int {
        val id = context.resources.getIdentifier("ic_stat_concrnt", "drawable", context.packageName)
        return if (id != 0) id else context.applicationInfo.icon
    }
}
