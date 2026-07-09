import Foundation
import CryptoKit
import Security

/// Persists the on-device WebPush keypair (P-256 + 16-byte auth secret) and
/// the "self" account context in an App Group-shared Keychain, so both the
/// main app (tauri-plugin-push) and the NotifyService Notification Service
/// Extension can read them. Keys are `kSecAttrAccessibleAfterFirstUnlock` and
/// explicitly NOT synchronizable — these are WebPush subscription secrets
/// tied to this device's registration, not general-purpose passwords.
public enum PushKeyStore {
    /// Must match the App Group configured in project.yml entitlements for
    /// both the main app target and NotifyService.
    public static let appGroup = "group.world.concrnt.app"

    private static let service = "world.concrnt.app.push"
    private static let accountPrivateKey = "p256-private"
    private static let accountAuthSecret = "auth-secret"

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? .standard
    }

    public struct Keys {
        public let privateKey: P256.KeyAgreement.PrivateKey
        public let publicKeyBytes: Data
        public let auth: Data
    }

    public enum KeyStoreError: Error {
        case keychainWrite(OSStatus)
        case keychainDelete(OSStatus)
    }

    /// Returns the existing keypair/auth secret, generating and persisting one
    /// on first call.
    public static func getOrCreateKeys() throws -> Keys {
        if let privateKeyData = readKeychainItem(account: accountPrivateKey),
           let auth = readKeychainItem(account: accountAuthSecret) {
            let privateKey = try P256.KeyAgreement.PrivateKey(rawRepresentation: privateKeyData)
            return Keys(privateKey: privateKey, publicKeyBytes: privateKey.publicKey.x963Representation, auth: auth)
        }

        let privateKey = P256.KeyAgreement.PrivateKey()
        var authBytes = [UInt8](repeating: 0, count: 16)
        let status = SecRandomCopyBytes(kSecRandomDefault, authBytes.count, &authBytes)
        guard status == errSecSuccess else { throw KeyStoreError.keychainWrite(status) }
        let auth = Data(authBytes)

        try writeKeychainItem(account: accountPrivateKey, data: privateKey.rawRepresentation)
        try writeKeychainItem(account: accountAuthSecret, data: auth)

        return Keys(privateKey: privateKey, publicKeyBytes: privateKey.publicKey.x963Representation, auth: auth)
    }

    public static func resetKeys() {
        deleteKeychainItem(account: accountPrivateKey)
        deleteKeychainItem(account: accountAuthSecret)
    }

    public static func setContext(homeDomain: String?, ccid: String?) {
        defaults.set(homeDomain, forKey: "homeDomain")
        defaults.set(ccid, forKey: "ccid")
    }

    public static var homeDomain: String? { defaults.string(forKey: "homeDomain") }
    public static var ccid: String? { defaults.string(forKey: "ccid") }

    /// Buffers a deep link so a cold-started app can retrieve it once the
    /// webview is ready. Written by the app delegate's
    /// `didReceive response` handler for a tap that launched the process.
    public static func bufferLaunch(uri: String?, view: String?) {
        defaults.set(uri, forKey: "launchUri")
        defaults.set(view, forKey: "launchView")
    }

    /// Reads and clears the buffered launch deep link.
    public static func consumeLaunch() -> (uri: String?, view: String?) {
        let uri = defaults.string(forKey: "launchUri")
        let view = defaults.string(forKey: "launchView")
        defaults.removeObject(forKey: "launchUri")
        defaults.removeObject(forKey: "launchView")
        return (uri, view)
    }

    // MARK: - Keychain plumbing

    private static func baseQuery(account: String) -> [CFString: Any] {
        [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecAttrAccessGroup: appGroup
        ]
    }

    private static func readKeychainItem(account: String) -> Data? {
        var query = baseQuery(account: account)
        query[kSecReturnData] = kCFBooleanTrue
        query[kSecMatchLimit] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    private static func writeKeychainItem(account: String, data: Data) throws {
        deleteKeychainItem(account: account)

        var attributes = baseQuery(account: account)
        attributes[kSecValueData] = data
        attributes[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlock

        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeyStoreError.keychainWrite(status) }
    }

    private static func deleteKeychainItem(account: String) {
        SecItemDelete(baseQuery(account: account) as CFDictionary)
    }
}
