import Foundation
import ObjectiveC
import Tauri
import UIKit
import UserNotifications
import WebKit
import PushShared

struct CheckPermissionResponse: Codable {
    let status: String
}

struct RequestPermissionResponse: Codable {
    let granted: Bool
}

struct GetTokenResponse: Codable {
    let platform: String
    let token: String
    let environment: String
}

struct GetOrCreateKeysResponse: Codable {
    let p256dh: String
    let auth: String
}

class SetContextArgs: Decodable {
    let homeDomain: String?
    let ccid: String?
}

struct GetLaunchNotificationResponse: Codable {
    let uri: String?
    let view: String?
}

class PushPlugin: Plugin, UNUserNotificationCenterDelegate {
    /// The app delegate swizzling hooks below can't reach an arbitrary Plugin
    /// instance, so they call back through this weak static reference set in
    /// `load(webview:)`.
    static weak var shared: PushPlugin?

    private var pendingTokenInvoke: Invoke?

    override func load(webview: WKWebView) {
        PushPlugin.shared = self
        UNUserNotificationCenter.current().delegate = self
        installRemoteNotificationHooks()
        bufferLaunchIfPresent()
    }

    private func bufferLaunchIfPresent() {
        // Cold-start via a notification tap is captured by the app delegate
        // hook below (didReceive response) before the plugin loads, buffering
        // into PushKeyStore; nothing else to do here. This function exists so
        // the intent is documented at the call site that matters (load()).
    }

    // MARK: - Remote notification registration (swizzled onto the app's AppDelegate)

    private func installRemoteNotificationHooks() {
        guard let delegate = UIApplication.shared.delegate else { return }
        let cls: AnyClass = object_getClass(delegate)!

        let didRegisterSelector = #selector(UIApplicationDelegate.application(_:didRegisterForRemoteNotificationsWithDeviceToken:))
        if !class_respondsToSelector(cls, didRegisterSelector) {
            let block: @convention(block) (AnyObject, UIApplication, Data) -> Void = { _, _, deviceToken in
                PushPlugin.shared?.handleDeviceToken(deviceToken)
            }
            let imp = imp_implementationWithBlock(block)
            class_addMethod(cls, didRegisterSelector, imp, "v@:@@")
        }

        let didFailSelector = #selector(UIApplicationDelegate.application(_:didFailToRegisterForRemoteNotificationsWithError:))
        if !class_respondsToSelector(cls, didFailSelector) {
            let block: @convention(block) (AnyObject, UIApplication, Error) -> Void = { _, _, error in
                PushPlugin.shared?.handleRegistrationFailure(error)
            }
            let imp = imp_implementationWithBlock(block)
            class_addMethod(cls, didFailSelector, imp, "v@:@@")
        }
    }

    private func handleDeviceToken(_ deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        guard let invoke = pendingTokenInvoke else { return }
        pendingTokenInvoke = nil
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        invoke.resolve(GetTokenResponse(platform: "apns", token: hex, environment: environment))
    }

    private func handleRegistrationFailure(_ error: Error) {
        guard let invoke = pendingTokenInvoke else { return }
        pendingTokenInvoke = nil
        invoke.reject(error.localizedDescription)
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Still show the alert/sound/badge when the app is in the foreground.
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let uri = userInfo["cc-deeplink"] as? String
        let view = (userInfo["cc-view"] as? String) ?? (uri != nil ? "post" : "notifications")

        // Buffer for cold start (get_launch_notification) regardless, and
        // additionally trigger the live event for a warm start; the app JS
        // decides which path applies (it checks the buffer once on launch).
        PushKeyStore.bufferLaunch(uri: uri, view: view)

        var payload: JSObject = ["view": view]
        if let uri = uri {
            payload["uri"] = uri
        } else {
            payload["uri"] = NSNull()
        }
        trigger("notificationTapped", data: payload)

        completionHandler()
    }

    // MARK: - Commands

    @objc public func checkPermission(_ invoke: Invoke) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let status: String
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                status = "granted"
            case .denied:
                status = "denied"
            default:
                status = "prompt"
            }
            invoke.resolve(CheckPermissionResponse(status: status))
        }
    }

    @objc public func requestPermission(_ invoke: Invoke) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error = error {
                invoke.reject(error.localizedDescription)
                return
            }
            invoke.resolve(RequestPermissionResponse(granted: granted))
        }
    }

    @objc public func getToken(_ invoke: Invoke) {
        pendingTokenInvoke = invoke
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    @objc public func getOrCreateKeys(_ invoke: Invoke) {
        do {
            let keys = try PushKeyStore.getOrCreateKeys()
            invoke.resolve(GetOrCreateKeysResponse(
                p256dh: keys.publicKeyBytes.base64URLEncodedString(),
                auth: keys.auth.base64URLEncodedString()
            ))
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }

    @objc public func resetKeys(_ invoke: Invoke) {
        PushKeyStore.resetKeys()
        invoke.resolve()
    }

    @objc public func setContext(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SetContextArgs.self)
        PushKeyStore.setContext(homeDomain: args.homeDomain, ccid: args.ccid)
        invoke.resolve()
    }

    @objc public func getLaunchNotification(_ invoke: Invoke) {
        let (uri, view) = PushKeyStore.consumeLaunch()
        invoke.resolve(GetLaunchNotificationResponse(uri: uri, view: view))
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

@_cdecl("init_plugin_push")
func initPlugin() -> Plugin {
    return PushPlugin()
}
