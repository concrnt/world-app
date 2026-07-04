import Foundation

/// Parses a decrypted concrnt.Event push payload and builds display content.
/// Mirrors the per-schema Japanese copy from the v1 web client's service
/// worker (references/concrnt-world/app/src/sw.js), adapted to v2's
/// Event/SignedDocument/Document envelope (the pushed payload is the whole
/// Event, not a bare association document, and the inner Document is a
/// JSON-encoded string that must be parsed again). Shared between the
/// Notification Service Extension and (for symmetry/testability) the app.
public enum NotificationContent {
    public struct Result {
        public let title: String
        public let body: String?
        public let targetUri: String?
        public let view: String

        public init(title: String, body: String?, targetUri: String?, view: String) {
            self.title = title
            self.body = body
            self.targetUri = targetUri
            self.view = view
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
            buildContent(event: event)
        }

        // result: Result?? — outer optional from try? (timeout/cancellation),
        // inner optional from buildContent itself (parse failure / self-action).
        return result.flatMap { $0 } ?? fallback
    }

    private static func buildContent(event: [String: Any]) async -> Result? {
        guard let documents = event["documents"] as? [String: Any] else { return nil }

        var signedDoc: [String: Any]?
        if let assocKey = event["association"] as? String, let sd = documents[assocKey] as? [String: Any] {
            signedDoc = sd
        } else {
            for (_, raw) in documents {
                guard let sd = raw as? [String: Any],
                      let docStr = sd["document"] as? String,
                      let docData = docStr.data(using: .utf8),
                      let doc = try? JSONSerialization.jsonObject(with: docData) as? [String: Any],
                      doc["kind"] as? String == "association"
                else { continue }
                signedDoc = sd
                break
            }
        }

        guard let sd = signedDoc,
              let docStr = sd["document"] as? String,
              let docData = docStr.data(using: .utf8),
              let doc = try? JSONSerialization.jsonObject(with: docData) as? [String: Any]
        else { return nil }

        let author = doc["author"] as? String ?? ""
        let isSelfAction = PushKeyStore.ccid.map { !$0.isEmpty && $0 == author } ?? false

        let schema = doc["schema"] as? String ?? ""
        let value = doc["value"] as? [String: Any] ?? [:]
        let profileOverride = value["profileOverride"] as? [String: Any]
        let overrideUsername = nonEmpty(profileOverride?["username"] as? String)

        let homeDomain = PushKeyStore.homeDomain
        var username = overrideUsername
        if username == nil, !isSelfAction, let home = homeDomain {
            username = await resolveUsername(
                homeDomain: home,
                author: author,
                signedDoc: sd,
                profileId: nonEmpty(profileOverride?["profileID"] as? String)
            )
        }
        let finalUsername = username ?? "名無し"

        let associate = nonEmpty(doc["associate"] as? String)

        func messageBody(for uri: String?) async -> String? {
            guard let home = homeDomain, let uri = uri else { return nil }
            return await resolveMessageBody(homeDomain: home, targetUri: uri)
        }

        switch schema {
        case schemaLike:
            return Result(
                title: "\(finalUsername)さんがあなたの投稿にいいねしました",
                body: await messageBody(for: associate),
                targetUri: associate,
                view: "post"
            )
        case schemaReaction:
            let shortcode = value["shortcode"] as? String ?? ""
            return Result(
                title: "\(finalUsername)さんがあなたの投稿にリアクションしました :\(shortcode):",
                body: await messageBody(for: associate),
                targetUri: associate,
                view: "post"
            )
        case schemaReroute:
            return Result(
                title: "\(finalUsername)さんがあなたの投稿をリルートしました",
                body: await messageBody(for: associate),
                targetUri: associate,
                view: "post"
            )
        case schemaReply:
            let target = nonEmpty(value["targetURI"] as? String) ?? associate
            return Result(
                title: "\(finalUsername)さんがあなたの投稿にリプライしました",
                body: await messageBody(for: target),
                targetUri: target,
                view: "post"
            )
        case schemaMention:
            return Result(
                title: "\(finalUsername)さんがあなたをメンションしました",
                body: await messageBody(for: associate),
                targetUri: associate,
                view: "post"
            )
        case schemaReadAccessRequest:
            return Result(title: "\(finalUsername)さんが閲覧リクエストを送信しています", body: nil, targetUri: nil, view: "notifications")
        case schemaFollowAck:
            return Result(title: "\(finalUsername)さんにフォローされました", body: nil, targetUri: nil, view: "notifications")
        default:
            return fallback
        }
    }

    private static func resolveUsername(
        homeDomain: String,
        author: String,
        signedDoc: [String: Any],
        profileId: String?
    ) async -> String? {
        guard let authorDomain = await resolveAuthorDomain(homeDomain: homeDomain, author: author, signedDoc: signedDoc) else {
            return nil
        }
        let profile = profileId ?? "main"
        let uri = "cckv://\(author)/concrnt.world/profiles/\(profile)"
        guard let profileDoc = await fetchResolvedDocument(domain: authorDomain, uri: uri) else { return nil }
        let value = profileDoc["value"] as? [String: Any]
        return nonEmpty(value?["username"] as? String)
    }

    private static func resolveAuthorDomain(homeDomain: String, author: String, signedDoc: [String: Any]) async -> String? {
        // Api.commit() always embeds the author's own entity document under
        // this reference key, so this usually avoids a network round trip.
        if let references = signedDoc["references"] as? [String: Any],
           let embedded = references["cckv://\(author)"] as? [String: Any],
           let embeddedDocStr = embedded["document"] as? String,
           let embeddedDocData = embeddedDocStr.data(using: .utf8),
           let embeddedDoc = try? JSONSerialization.jsonObject(with: embeddedDocData) as? [String: Any],
           let value = embeddedDoc["value"] as? [String: Any],
           let domain = nonEmpty(value["domain"] as? String) {
            return domain
        }

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
