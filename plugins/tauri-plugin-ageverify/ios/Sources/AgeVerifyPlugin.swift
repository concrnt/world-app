import SwiftRs
import Tauri
import UIKit
import WebKit
import os.log

// Apple's Declared Age Range framework ships in the iOS 26.2 SDK. Guarded with
// `canImport` so the plugin still compiles on older SDKs (the runtime path is
// additionally gated behind `@available(iOS 26.2, *)`).
#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

let logger = Logger(subsystem: "world.concrnt.app", category: "AgeVerifyPlugin")

class AgeVerifyPlugin: Plugin {

    // The single age gate we care about for the App Store under-13 requirement.
    private static let ageGate = 13

    /// Requests the user's age band via Apple's Declared Age Range API.
    ///
    /// The age band is used purely on-device to decide whether to show the
    /// block screen — it is never persisted raw nor transmitted anywhere.
    ///
    /// Resolves `{ ageRange, available, declined }` where `ageRange` is
    /// "under13" | "over13" | "unknown".
    @objc public func requestAgeRange(_ invoke: Invoke) {
        #if canImport(DeclaredAgeRange)
        if #available(iOS 26.2, *) {
            Task { @MainActor in
                guard let viewController = AgeVerifyPlugin.topViewController() else {
                    logger.error("no view controller to present the age-range sheet")
                    invoke.resolve(["ageRange": "unknown", "available": false, "declined": false])
                    return
                }

                do {
                    // NOTE: verify this exact call against the iOS 26.2 SDK. The
                    // Declared Age Range API returns the band relative to the
                    // gate(s) we pass, without ever exposing a birth date.
                    let response = try await AgeRangeService.shared.requestAgeRange(
                        ageGates: AgeVerifyPlugin.ageGate,
                        in: viewController
                    )

                    switch response {
                    case .declinedSharing:
                        invoke.resolve(["ageRange": "unknown", "available": true, "declined": true])
                    case .sharing(let range):
                        let band = AgeVerifyPlugin.band(lowerBound: range.lowerBound)
                        invoke.resolve(["ageRange": band, "available": true, "declined": false])
                    @unknown default:
                        invoke.resolve(["ageRange": "unknown", "available": true, "declined": false])
                    }
                } catch {
                    logger.error("requestAgeRange failed: \(error.localizedDescription)")
                    // Fail open: an error must not lock legitimate users out.
                    invoke.resolve(["ageRange": "unknown", "available": false, "declined": false])
                }
            }
            return
        }
        #endif

        // iOS < 26.2 or the framework is unavailable: report unavailable so the
        // frontend treats it as a pass.
        invoke.resolve(["ageRange": "unknown", "available": false, "declined": false])
    }

    // Maps the shared range's lower bound to our simple under/over-13 band.
    // With a single 13 gate, a lower bound >= 13 means "13 and over"; anything
    // else (including a nil lower bound) means the person is under 13.
    private static func band(lowerBound: Int?) -> String {
        if let lower = lowerBound, lower >= ageGate {
            return "over13"
        }
        return "under13"
    }

    // Walks the active window's root view controller down to the topmost
    // presented controller so the system sheet has something to attach to.
    @MainActor
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first

        let keyWindow = scene?.windows.first { $0.isKeyWindow } ?? scene?.windows.first

        var top = keyWindow?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}

@_cdecl("init_plugin_ageverify")
func initPlugin() -> Plugin {
    return AgeVerifyPlugin()
}
