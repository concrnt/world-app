package world.concrnt.plugin.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Parses a decrypted concrnt.Event push payload and shows a system
 * notification. Mirrors the per-schema Japanese copy from the v1 web client's
 * service worker (references/concrnt-world/app/src/sw.js), adapted to v2's
 * Event/SignedDocument/Document envelope (the pushed payload is the whole
 * Event, not a bare association document, and the inner Document is a
 * JSON-encoded string that must be parsed again).
 */
object NotificationRenderer {
    private const val CHANNEL_ID = "concrnt-notifications"
    private const val FETCH_TIMEOUT_MS = 3000
    private const val FALLBACK_TITLE = "新しい通知があります"

    private const val SCHEMA_LIKE = "https://schema.concrnt.world/a/like.json"
    private const val SCHEMA_REACTION = "https://schema.concrnt.world/a/reaction.json"
    private const val SCHEMA_REROUTE = "https://schema.concrnt.world/a/reroute.json"
    private const val SCHEMA_REPLY = "https://schema.concrnt.world/a/reply.json"
    private const val SCHEMA_MENTION = "https://schema.concrnt.world/a/mention.json"
    private const val SCHEMA_READ_ACCESS_REQUEST = "https://schema.concrnt.world/a/readaccessrequest.json"
    private const val SCHEMA_FOLLOW_ACK = "https://schema.concrnt.world/ack/follow.json"

    private data class Content(val title: String, val body: String?, val targetUri: String?, val view: String)

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
            ?.let { runCatching { buildContent(context, String(it, Charsets.UTF_8)) }.getOrNull() }
            ?: Content(FALLBACK_TITLE, null, null, "notifications")

        display(context, content)
    }

    private fun buildContent(context: Context, eventJson: String): Content? {
        val event = JSONObject(eventJson)
        val documents = event.optJSONObject("documents") ?: return null

        var signedDoc: JSONObject? = null
        val associationKey = event.optString("association", "")
        if (associationKey.isNotEmpty() && documents.has(associationKey)) {
            signedDoc = documents.getJSONObject(associationKey)
        } else {
            val keys = documents.keys()
            while (keys.hasNext()) {
                val candidate = documents.getJSONObject(keys.next())
                val docStr = candidate.optString("document", "")
                if (docStr.isEmpty()) continue
                val kind = runCatching { JSONObject(docStr).optString("kind") }.getOrNull()
                if (kind == "association") {
                    signedDoc = candidate
                    break
                }
            }
        }
        if (signedDoc == null) return null

        val docStr = signedDoc.optString("document", "")
        if (docStr.isEmpty()) return null
        val doc = JSONObject(docStr)

        val author = doc.optString("author", "")
        val selfCcid = PushKeyStore.getCcid(context)
        if (selfCcid != null && author == selfCcid) return null // suppress notifications about our own actions

        val schema = doc.optString("schema", "")
        val value = doc.optJSONObject("value") ?: JSONObject()
        val profileOverride = value.optJSONObject("profileOverride")
        val overrideUsername = profileOverride?.optString("username", "")?.takeIf { it.isNotEmpty() }

        val homeDomain = PushKeyStore.getHomeDomain(context)
        val username = overrideUsername
            ?: homeDomain?.let { resolveUsername(it, author, signedDoc, profileOverride?.optString("profileID", "")?.takeIf { p -> p.isNotEmpty() }) }
            ?: "名無し"

        val associate = doc.optString("associate", "").takeIf { it.isNotEmpty() }

        return when (schema) {
            SCHEMA_LIKE -> Content(
                "${username}さんがあなたの投稿にいいねしました",
                homeDomain?.let { associate?.let { uri -> resolveMessageBody(it, uri) } },
                associate,
                "post"
            )
            SCHEMA_REACTION -> Content(
                "${username}さんがあなたの投稿にリアクションしました :${value.optString("shortcode", "")}:",
                homeDomain?.let { associate?.let { uri -> resolveMessageBody(it, uri) } },
                associate,
                "post"
            )
            SCHEMA_REROUTE -> Content(
                "${username}さんがあなたの投稿をリルートしました",
                homeDomain?.let { associate?.let { uri -> resolveMessageBody(it, uri) } },
                associate,
                "post"
            )
            SCHEMA_REPLY -> {
                val target = value.optString("targetURI", "").takeIf { it.isNotEmpty() } ?: associate
                Content(
                    "${username}さんがあなたの投稿にリプライしました",
                    homeDomain?.let { target?.let { uri -> resolveMessageBody(it, uri) } },
                    target,
                    "post"
                )
            }
            SCHEMA_MENTION -> Content(
                "${username}さんがあなたをメンションしました",
                homeDomain?.let { associate?.let { uri -> resolveMessageBody(it, uri) } },
                associate,
                "post"
            )
            SCHEMA_READ_ACCESS_REQUEST -> Content("${username}さんが閲覧リクエストを送信しています", null, null, "notifications")
            SCHEMA_FOLLOW_ACK -> Content("${username}さんにフォローされました", null, null, "notifications")
            else -> Content(FALLBACK_TITLE, null, null, "notifications")
        }
    }

    /** Resolves the author's display name via the embedded entity reference or a resolve() round trip. */
    private fun resolveUsername(homeDomain: String, author: String, signedDoc: JSONObject, profileId: String?): String? {
        val authorDomain = resolveAuthorDomain(homeDomain, author, signedDoc) ?: return null
        val profile = profileId ?: "main"
        val uri = "cckv://$author/concrnt.world/profiles/$profile"
        val profileDoc = fetchResolvedDocument(authorDomain, uri) ?: return null
        val username = profileDoc.optJSONObject("value")?.optString("username", "")
        return username?.takeIf { it.isNotEmpty() }
    }

    private fun resolveAuthorDomain(homeDomain: String, author: String, signedDoc: JSONObject): String? {
        // Api.commit() always embeds the author's own entity document under this
        // reference key, so this usually avoids a network round trip entirely.
        val references = signedDoc.optJSONObject("references")
        val embedded = references?.optJSONObject("cckv://$author")
        val embeddedDocStr = embedded?.optString("document", "")
        if (!embeddedDocStr.isNullOrEmpty()) {
            val domain = runCatching { JSONObject(embeddedDocStr).optJSONObject("value")?.optString("domain", "") }.getOrNull()
            if (!domain.isNullOrEmpty()) return domain
        }

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
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(content.title)
            .apply { content.body?.let { setContentText(it) } }
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .apply { content.targetUri?.let { setGroup(it) } }
            .build()

        val notificationId = (content.targetUri ?: content.title).hashCode()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }
}
