import UserNotifications
import PushShared

/// Decrypts the WebPush body relayed (still encrypted) through webpush-relay
/// as an APNs payload keyed "p" (base64url, no padding) + "e" ("aes128gcm"),
/// then rewrites the notification's title/body per the association schema.
/// If anything fails (missing/undecryptable payload, network enrichment
/// timeout, ...), the relay's placeholder alert ("新しい通知があります") is
/// left as-is — see PushCrypto.swift / NotificationContent.swift in
/// tauri-plugin-push/ios/Sources/PushShared for the shared logic with the
/// Android FirebaseMessagingService.
class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler

        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            contentHandler(request.content)
            return
        }
        bestAttemptContent = content

        Task {
            await process(content: content)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Out of time; deliver whatever we've got (possibly still the
        // relay's placeholder alert) rather than nothing.
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            self.contentHandler = nil
            contentHandler(bestAttemptContent)
        }
    }

    private func process(content: UNMutableNotificationContent) async {
        defer { deliver() }

        guard let encoding = content.userInfo["e"] as? String, encoding == "aes128gcm",
              let encoded = content.userInfo["p"] as? String,
              let body = Data(base64URLEncoded: encoded)
        else {
            return
        }

        do {
            let keys = try PushKeyStore.getOrCreateKeys()
            let decrypted = try PushCrypto.decrypt(
                body: body,
                privateKey: keys.privateKey,
                uaPublicBytes: keys.publicKeyBytes,
                auth: keys.auth
            )
            let result = await NotificationContent.build(fromDecryptedEvent: decrypted)

            content.title = result.title
            if let body = result.body {
                content.body = body
            }
            if let uri = result.targetUri {
                content.userInfo["cc-deeplink"] = uri
                content.threadIdentifier = uri
            }
            content.userInfo["cc-view"] = result.view
        } catch {
            // Decryption failed (stale/rotated key, corrupt payload, ...);
            // leave the placeholder alert untouched.
        }
    }

    private func deliver() {
        guard let contentHandler = contentHandler, let content = bestAttemptContent else { return }
        self.contentHandler = nil
        contentHandler(content)
    }
}
