import SwiftRs
import Tauri
import UIKit
import WebKit
import os.log

let logger = Logger(subsystem: "world.concrnt.app", category: "KeyboardPlugin")

struct KeyboardChangeEvent: Encodable {
    let visible: Bool
    let height: Double
    let duration: Double
}

class KeyboardPlugin: Plugin {

    @objc public override func load(webview: WKWebView) {
        // keyboardWillChangeFrame は show/hide/フレーム変更すべてで
        // アニメーション開始前に発火する(willShow/willHideより網羅的)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillChangeFrame(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil
        )
    }

    @objc func keyboardWillChangeFrame(_ notification: Notification) {
        guard
            let endFrame = (notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?
                .cgRectValue
        else { return }

        let duration =
            notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25

        // 画面下端とキーボードの重なり。hide時はendFrameが画面外に出て0になる。
        // QuickTypeバー切替等で同一表示中にも発火するため、差分ではなく毎回絶対値で計算する。
        let height = max(0, UIScreen.main.bounds.maxY - endFrame.minY)

        do {
            try trigger(
                "keyboardChange",
                data: KeyboardChangeEvent(
                    visible: height > 0,
                    height: Double(height),
                    duration: duration
                )
            )
        } catch {
            logger.error("failed to trigger keyboardChange: \(error)")
        }
    }
}

@_cdecl("init_plugin_keyboard")
func initPlugin() -> Plugin {
    return KeyboardPlugin()
}
