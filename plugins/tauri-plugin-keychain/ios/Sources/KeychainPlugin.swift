import SwiftRs
import Tauri
import WebKit
import ObjectiveC
import Foundation
import UniformTypeIdentifiers
import Security

class KeychainArgs: Decodable {
    let key: String
    let password: String?
}
struct KeychainResponse: Codable {
    let password: String?
}

// このプラグインが扱うのは iCloud キーチェーン同期コピー(kSecAttrSynchronizable: true)のみ。
// 端末上の「消えない正コピー」はアプリ側(Rust: accounts.rs)が tauri-plugin-store に別途保持し、
// 読み取り時に両者を統合(union)する。したがって同期コピーが一時的に読めなくても鍵は失われない。
//
// 検索クエリには kSecAttrAccessible を含めない(属性は書き込み時のみ指定)。
// accessibility を検索キーにすると、アイテムの実際の accessibility と不一致のとき false negative になり得る。
// synchronizable コピーには ThisDeviceOnly が使えないため、書き込みには AfterFirstUnlock を用いる。
class KeychainPlugin: Plugin {
    @objc public func getItem(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(KeychainArgs.self)
        let key = args.key
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecReturnData: kCFBooleanTrue!,
            kSecMatchLimit: kSecMatchLimitOne,
            kSecAttrSynchronizable: kCFBooleanTrue!
        ] as CFDictionary

        var data: AnyObject?
        let status = SecItemCopyMatching(query, &data)

        guard status == errSecSuccess, let resultData = data as? Data else {
            invoke.resolve(KeychainResponse(password: nil))
            return
        }

        let password = String(data: resultData, encoding: .utf8)
        invoke.resolve(KeychainResponse(password: password))
    }

    @objc public func hasItem(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(KeychainArgs.self)
        let key = args.key
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecReturnData: kCFBooleanTrue!,
            kSecMatchLimit: kSecMatchLimitOne,
            kSecAttrSynchronizable: kCFBooleanTrue!
        ] as CFDictionary

        var data: AnyObject?
        let status = SecItemCopyMatching(query, &data)

        invoke.resolve(status == errSecSuccess)
    }

    @objc public func saveItem(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(KeychainArgs.self)
        let key = args.key
        let value = args.password ?? ""
        guard let data = value.data(using: .utf8) else {
            invoke.resolve(false)
            return
        }

        let attributes = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
            kSecAttrSynchronizable: kCFBooleanTrue!
        ] as CFDictionary
        // 新規追加専用: 既存アイテムがある場合は errSecDuplicateItem で失敗させ、
        // サイレント上書きを防ぐ。更新は updateItem を使うこと。
        let status = SecItemAdd(attributes, nil)

        invoke.resolve(status == errSecSuccess)
    }

    @objc public func updateItem(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(KeychainArgs.self)
        let key = args.key
        let value = args.password ?? ""
        guard let data = value.data(using: .utf8) else {
            invoke.resolve(false)
            return
        }

        // kSecAttrSynchronizable を含めないと synchronizable なアイテムにマッチしない。
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecAttrSynchronizable: kCFBooleanTrue!
        ] as CFDictionary
        let attributesToUpdate = [
            kSecValueData: data
        ] as CFDictionary

        // in-place 更新のみ。存在しなければ errSecItemNotFound で失敗する。
        // 削除→再追加はクラッシュ時にアイテムが消える時間窓ができるため行わない。
        let status = SecItemUpdate(query, attributesToUpdate)

        invoke.resolve(status == errSecSuccess)
    }

    @objc public func removeItem(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(KeychainArgs.self)
        let key = args.key
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecAttrSynchronizable: kCFBooleanTrue!
        ] as CFDictionary

        let status = SecItemDelete(query)
        invoke.resolve(status == errSecSuccess || status == errSecItemNotFound)
    }
}

@_cdecl("init_plugin_keychain")
func initPlugin() -> Plugin {
    return KeychainPlugin()
}
