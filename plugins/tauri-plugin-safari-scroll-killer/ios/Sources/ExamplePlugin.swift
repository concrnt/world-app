import SwiftRs
import Tauri
import UIKit
import WebKit
import os.log

let logger = Logger(subsystem: "world.concrnt.app", category: "ExamplePlugin")

class ExamplePlugin: Plugin {

    @objc public override func load(webview: WKWebView) {
        logger.log("ExamplePlugin loaded")
        webview.scrollView.isScrollEnabled = false
        webview.scrollView.contentInsetAdjustmentBehavior = .never
        webview.scrollView.automaticallyAdjustsScrollIndicatorInsets = false

/*
        NotificationCenter.default.removeObserver(
            webview,
            name: UIResponder.keyboardDidChangeFrameNotification,
            object: nil
        )
        NotificationCenter.default.removeObserver(
            webview,
            name: UIResponder.keyboardDidHideNotification,
            object: nil
        )
        NotificationCenter.default.removeObserver(
            webview,
            name: UIResponder.keyboardDidShowNotification,
            object: nil
        )
    */
        NotificationCenter.default.removeObserver(
            webview,
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil
        )
        NotificationCenter.default.removeObserver(
            webview,
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
        NotificationCenter.default.removeObserver(
            webview,
            name: UIResponder.keyboardWillShowNotification,
            object: nil
        )

    }

    @objc public func ping(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(PingArgs.self)
            invoke.resolve(["value": args.value ?? ""])
    }

}

@_cdecl("init_plugin_safari_scroll_killer")
func initPlugin() -> Plugin {
    return ExamplePlugin()
}

class PingArgs: Decodable {
    let value: String?
}

