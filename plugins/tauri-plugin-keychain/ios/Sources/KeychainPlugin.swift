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

class KeychainPlugin: Plugin {
    @objc public func getItem(_ invoke: Invoke) throws {

    let args = try invoke.parseArgs(KeychainArgs.self)
        let key = args.key
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecReturnData: kCFBooleanTrue!,
            kSecMatchLimit: kSecMatchLimitOne,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
            kSecAttrSynchronizable: kCFBooleanTrue!
        ] as CFDictionary

        var data: AnyObject?
        let status = SecItemCopyMatching(query, &data)

        guard status == errSecSuccess, let resultData = data as? Data else {
            invoke.resolve(KeychainResponse(password: nil))
            return
        }

        let password = String(data: resultData, encoding: .utf8)

        let resp = KeychainResponse(password: password)
        invoke.resolve(resp)
    }

    @objc public func hasItem(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(KeychainArgs.self)
        let key = args.key
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecReturnData: kCFBooleanTrue!,
            kSecMatchLimit: kSecMatchLimitOne,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
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
        // 新規追加専用: 既存アイテムがある場合はerrSecDuplicateItemで失敗させ、
        // サイレント上書きによる鍵の紛失を防ぐ。更新はupdateItemを使うこと。
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

        // kSecAttrSynchronizableを含めないとsynchronizableなアイテムにマッチしない
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecAttrSynchronizable: kCFBooleanTrue!
        ] as CFDictionary
        let attributesToUpdate = [
            kSecValueData: data
        ] as CFDictionary

        // in-place更新のみ。存在しなければerrSecItemNotFoundで失敗する。
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
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
            kSecAttrSynchronizable: kCFBooleanTrue!
        ] as CFDictionary

        let status = SecItemDelete(query)
        invoke.resolve(status == errSecSuccess)
    }
}

@_cdecl("init_plugin_keychain")
func initPlugin() -> Plugin {
    return KeychainPlugin()
}
