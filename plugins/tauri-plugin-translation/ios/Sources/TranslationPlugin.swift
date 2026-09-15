import Foundation
import NaturalLanguage
import SwiftUI
import Tauri
import UIKit
import WebKit
import os.log

// Apple's Translation framework ships in the iOS 18 SDK. Guarded with
// `canImport` so the plugin still compiles on older SDKs (the runtime path is
// additionally gated behind `@available(iOS 18.0, *)`).
#if canImport(Translation)
import Translation
#endif

let logger = Logger(subsystem: "world.concrnt.app", category: "TranslationPlugin")

private struct DetectArgs: Decodable {
    let text: String
}

private struct TranslateArgs: Decodable {
    let text: String
    let targetLanguage: String
}

#if canImport(Translation)
/// On iOS 18-25 a `TranslationSession` can only be obtained through the SwiftUI
/// `.translationTask` modifier, and the session is only valid inside that
/// closure (using it after the view disappears or the configuration changes is
/// a fatalError). This bridge serialises translate requests onto a single
/// hidden host view: each job sets/invalidates the configuration, which re-runs
/// the task closure, which resumes the job's continuation.
@available(iOS 18.0, *)
@MainActor
final class TranslationBridge: ObservableObject {
    struct Job {
        let text: String
        let source: Locale.Language?
        let target: Locale.Language
        let continuation: CheckedContinuation<TranslationSession.Response, Error>
    }

    @Published var configuration: TranslationSession.Configuration?
    private var queue: [Job] = []
    private var current: Job?

    func translate(_ text: String, source: Locale.Language?, target: Locale.Language) async throws
        -> TranslationSession.Response
    {
        try await withCheckedThrowingContinuation { continuation in
            queue.append(Job(text: text, source: source, target: target, continuation: continuation))
            pump()
        }
    }

    private func pump() {
        guard current == nil, !queue.isEmpty else { return }
        let job = queue.removeFirst()
        current = job
        if var config = configuration, config.source == job.source, config.target == job.target {
            // Same language pair as last time: bump the version so translationTask runs again.
            config.invalidate()
            configuration = config
        } else {
            configuration = TranslationSession.Configuration(source: job.source, target: job.target)
        }
    }

    /// Called from the `.translationTask` action. The session must not escape this call.
    func handle(_ session: TranslationSession) async {
        guard let job = current else { return }
        do {
            let response = try await session.translate(job.text)
            job.continuation.resume(returning: response)
        } catch {
            job.continuation.resume(throwing: error)
        }
        current = nil
        pump()
    }
}

@available(iOS 18.0, *)
struct TranslationHostView: View {
    @ObservedObject var bridge: TranslationBridge

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .translationTask(bridge.configuration) { session in
                await bridge.handle(session)
            }
    }
}
#endif

class TranslationPlugin: Plugin {
    // TranslationBridge, type-erased so the stored property compiles below iOS 18.
    private var bridgeBox: AnyObject?
    private var host: UIViewController?

    @objc public func isAvailable(_ invoke: Invoke) {
        #if canImport(Translation) && !targetEnvironment(simulator)
        // The Translation framework does not function in the Simulator.
        if #available(iOS 18.0, *) {
            invoke.resolve(["available": true])
            return
        }
        #endif
        invoke.resolve(["available": false])
    }

    @objc public func detectLanguage(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(DetectArgs.self)
        let language = NLLanguageRecognizer.dominantLanguage(for: args.text)?.rawValue
        invoke.resolve(["language": language])
    }

    @objc public func translate(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(TranslateArgs.self)
        #if canImport(Translation) && !targetEnvironment(simulator)
        if #available(iOS 18.0, *) {
            Task { @MainActor in
                guard let bridge = self.installHostIfNeeded() else {
                    invoke.reject("failed: no window to host the translation session")
                    return
                }
                let target = Locale.Language(identifier: args.targetLanguage)
                let detected = NLLanguageRecognizer.dominantLanguage(for: args.text).map {
                    Locale.Language(identifier: $0.rawValue)
                }

                // Same language: the framework rejects identity pairs, so answer directly
                // (the frontend treats source == target as "no translation needed").
                if let detected, detected.languageCode == target.languageCode {
                    invoke.resolve([
                        "text": args.text,
                        "sourceLanguage": detected.minimalIdentifier,
                        "targetLanguage": target.minimalIdentifier,
                        "engine": "apple",
                    ])
                    return
                }

                // Prefer our own detection as an explicit source (a nil source makes the
                // framework show a language picker when it cannot identify the text).
                // If the guess is not a supported pair, fall back to framework detection.
                var source = detected
                let availability = LanguageAvailability()
                if let detected, await availability.status(from: detected, to: target) == .unsupported {
                    source = nil
                }
                if source == nil {
                    let status = try? await availability.status(for: args.text, to: target)
                    if status == nil || status == .unsupported {
                        invoke.reject("unsupported: language pair")
                        return
                    }
                }

                do {
                    // Presents the system language-pack download sheet on first use.
                    let response = try await bridge.translate(args.text, source: source, target: target)
                    invoke.resolve([
                        "text": response.targetText,
                        "sourceLanguage": response.sourceLanguage.minimalIdentifier,
                        "targetLanguage": response.targetLanguage.minimalIdentifier,
                        "engine": "apple",
                    ])
                } catch {
                    logger.error("translate failed: \(error.localizedDescription)")
                    invoke.reject("failed: \(error.localizedDescription)")
                }
            }
            return
        }
        #endif
        invoke.reject("unsupported: translation requires iOS 18")
    }

    #if canImport(Translation)
    /// Lazily installs the 1x1 SwiftUI host that owns the translation session
    /// (installed once and never removed: a session whose view disappears is
    /// unusable). Returns nil when the WebView is not on screen yet.
    @available(iOS 18.0, *)
    @MainActor
    private func installHostIfNeeded() -> TranslationBridge? {
        if let bridge = bridgeBox as? TranslationBridge { return bridge }
        guard let parent = manager.viewController, parent.view.window != nil else { return nil }
        let bridge = TranslationBridge()
        let hosting = UIHostingController(rootView: TranslationHostView(bridge: bridge))
        hosting.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
        hosting.view.backgroundColor = .clear
        hosting.view.isUserInteractionEnabled = false
        parent.addChild(hosting)
        parent.view.addSubview(hosting.view)
        hosting.didMove(toParent: parent)
        bridgeBox = bridge
        host = hosting
        return bridge
    }
    #endif
}

@_cdecl("init_plugin_translation")
func initPlugin() -> Plugin {
    return TranslationPlugin()
}
