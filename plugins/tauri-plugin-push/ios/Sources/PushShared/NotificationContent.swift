import Foundation

/// Parses a decrypted concrnt push payload and builds display content.
/// Mirrors the per-schema Japanese copy from the v1 web client's service
/// worker (references/concrnt-world/app/src/sw.js). The push carries only the
/// minimal notification struct {uri, schema, author, createdAt} (see concrnt's
/// NotificationReactor.buildNotificationPayload); this resolves the association
/// document the uri points at (GET /api/v2/resolve) to recover value/associate,
/// then resolves the actor's profile and the target message body on demand.
/// Shared between the Notification Service Extension and (for symmetry/
/// testability) the app.
public enum NotificationContent {
    public struct Result {
        public let title: String
        public let body: String?
        public let targetUri: String?
        public let view: String
        /// Actor avatar URL, attached as the notification's image (the iOS
        /// equivalent of Android's large icon). nil when unavailable.
        public let imageUrl: String?

        public init(title: String, body: String?, targetUri: String?, view: String, imageUrl: String? = nil) {
            self.title = title
            self.body = body
            self.targetUri = targetUri
            self.view = view
            self.imageUrl = imageUrl
        }

        func with(imageUrl: String?) -> Result {
            Result(title: title, body: body, targetUri: targetUri, view: view, imageUrl: imageUrl)
        }
    }

    public static let fallbackTitle = "新しい通知があります"
    private static let fallback = Result(title: fallbackTitle, body: nil, targetUri: nil, view: "notifications")

    private static let schemaLike = "https://schema.concrnt.world/a/like.json"
    private static let schemaReaction = "https://schema.concrnt.world/a/reaction.json"
    private static let schemaReroute = "https://schema.concrnt.world/a/reroute.json"
    private static let schemaReply = "https://schema.concrnt.world/a/reply.json"
    private static let schemaMention = "https://schema.concrnt.world/a/mention.json"
    private static let schemaReadAccessRequest = "https://schema.concrnt.world/a/readaccessrequest.json"
    private static let schemaFollowAck = "https://schema.concrnt.world/ack/follow.json"

    /// The overall enrichment budget (author/profile/message-body lookups
    /// combined); NSEs get ~30s from iOS but we keep this well under that.
    private static let enrichmentTimeoutSeconds: TimeInterval = 5

    /// Never throws / never returns nil: on any parse failure, timeout, or
    /// unrecognized schema, falls back to a generic notification rather than
    /// leaving the user with no content at all (the OS won't let us truly
    /// cancel a push once sent).
    public static func build(fromDecryptedEvent decrypted: Data) async -> Result {
        guard let event = try? JSONSerialization.jsonObject(with: decrypted) as? [String: Any] else {
            return fallback
        }

        let result = try? await withTimeout(seconds: enrichmentTimeoutSeconds) {
            await buildContent(payload: event)
        }

        // result: Result?? — outer optional from try? (timeout/cancellation),
        // inner optional from buildContent itself (parse/resolve failure).
        return result.flatMap { $0 } ?? fallback
    }

    private static func buildContent(payload: [String: Any]) async -> Result? {
        // The push carries only the minimal notification struct
        // {uri, schema, author, createdAt}; everything else is fetched from the
        // association document the uri points at.
        guard let uri = nonEmpty(payload["uri"] as? String),
              let homeDomain = PushKeyStore.homeDomain
        else { return nil }

        // Resolve the association document (ccfs://...) the push refers to.
        guard let doc = await fetchResolvedDocument(domain: homeDomain, uri: uri) else { return nil }

        // schema/author come pre-resolved in the payload; fall back to the
        // resolved document if the server omitted them.
        let schema = nonEmpty(payload["schema"] as? String) ?? (doc["schema"] as? String ?? "")
        let author = nonEmpty(payload["author"] as? String) ?? (doc["author"] as? String ?? "")

        let value = doc["value"] as? [String: Any] ?? [:]
        let profileOverride = value["profileOverride"] as? [String: Any]
        let overrideUsername = nonEmpty(profileOverride?["username"] as? String)
        let overrideAvatar = nonEmpty(profileOverride?["avatar"] as? String)
        let profileId = nonEmpty(profileOverride?["profileID"] as? String)

        // Resolve the actor's profile once for both the display name and avatar.
        let actor = author.isEmpty
            ? nil
            : await resolveActorProfile(homeDomain: homeDomain, author: author, profileId: profileId)
        let finalUsername = overrideUsername ?? actor?.username ?? "名無し"
        // The notification's image (iOS large icon) is always the actor's avatar.
        let avatarUrl = overrideAvatar ?? actor?.avatar

        let associate = nonEmpty(doc["associate"] as? String)

        func messageBody(for uri: String?) async -> String? {
            guard let uri = uri else { return nil }
            return await resolveMessageBody(homeDomain: homeDomain, targetUri: uri)
        }

        let base: Result
        switch schema {
        case schemaLike:
            base = Result(
                title: "\(finalUsername)さんがあなたの投稿にいいねしました",
                body: await messageBody(for: associate),
                targetUri: associate,
                view: "post"
            )
        case schemaReaction:
            let shortcode = value["shortcode"] as? String ?? ""
            base = Result(
                title: "\(finalUsername)さんがあなたの投稿にリアクションしました :\(shortcode):",
                body: await messageBody(for: associate),
                targetUri: associate,
                view: "post"
            )
        case schemaReroute:
            base = Result(
                title: "\(finalUsername)さんがあなたの投稿をリルートしました",
                body: await messageBody(for: associate),
                targetUri: associate,
                view: "post"
            )
        case schemaReply:
            let target = nonEmpty(value["targetURI"] as? String) ?? associate
            base = Result(
                title: "\(finalUsername)さんがあなたの投稿にリプライしました",
                body: await messageBody(for: target),
                targetUri: target,
                view: "post"
            )
        case schemaMention:
            base = Result(
                title: "\(finalUsername)さんがあなたをメンションしました",
                body: await messageBody(for: associate),
                targetUri: associate,
                view: "post"
            )
        case schemaReadAccessRequest:
            base = Result(title: "\(finalUsername)さんが閲覧リクエストを送信しています", body: nil, targetUri: nil, view: "notifications")
        case schemaFollowAck:
            base = Result(title: "\(finalUsername)さんにフォローされました", body: nil, targetUri: nil, view: "notifications")
        default:
            return fallback
        }
        return base.with(imageUrl: avatarUrl)
    }

    private struct ActorProfile {
        let username: String?
        let avatar: String?
    }

    private static func resolveActorProfile(
        homeDomain: String,
        author: String,
        profileId: String?
    ) async -> ActorProfile? {
        guard !author.isEmpty,
              let authorDomain = await resolveAuthorDomain(homeDomain: homeDomain, author: author) else {
            return nil
        }
        let profile = profileId ?? "main"
        let uri = "cckv://\(author)/concrnt.world/profiles/\(profile)"
        guard let profileDoc = await fetchResolvedDocument(domain: authorDomain, uri: uri) else { return nil }
        let value = profileDoc["value"] as? [String: Any]
        return ActorProfile(
            username: nonEmpty(value?["username"] as? String),
            avatar: nonEmpty(value?["avatar"] as? String)
        )
    }

    private static func resolveAuthorDomain(homeDomain: String, author: String) async -> String? {
        guard let entityDoc = await fetchResolvedDocument(domain: homeDomain, uri: "cckv://\(author)") else { return nil }
        let value = entityDoc["value"] as? [String: Any]
        return nonEmpty(value?["domain"] as? String)
    }

    private static func resolveMessageBody(homeDomain: String, targetUri: String) async -> String? {
        guard let doc = await fetchResolvedDocument(domain: homeDomain, uri: targetUri) else { return nil }
        let value = doc["value"] as? [String: Any]
        guard let body = nonEmpty(value?["body"] as? String) else { return nil }
        return body.count > 140 ? String(body.prefix(140)) : body
    }

    /// GET /api/v2/resolve?uri=... — returns the raw SignedDocument, then the
    /// caller double-parses `.document`.
    private static func fetchResolvedDocument(domain: String, uri: String) async -> [String: Any]? {
        guard let encoded = uri.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://\(domain)/api/v2/resolve?uri=\(encoded)")
        else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 3

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let docStr = body["document"] as? String,
              let docData = docStr.data(using: .utf8),
              let doc = try? JSONSerialization.jsonObject(with: docData) as? [String: Any]
        else { return nil }

        return doc
    }

    private static func nonEmpty(_ s: String?) -> String? {
        guard let s = s, !s.isEmpty else { return nil }
        return s
    }

    /// Races `operation` against a timer; returns nil (and cancels the
    /// operation) if the timer wins.
    private static func withTimeout<T: Sendable>(
        seconds: TimeInterval,
        operation: @escaping @Sendable () async -> T
    ) async throws -> T? {
        try await withThrowingTaskGroup(of: T?.self) { group in
            group.addTask { await operation() }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                return nil
            }
            let first = try await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }
}
