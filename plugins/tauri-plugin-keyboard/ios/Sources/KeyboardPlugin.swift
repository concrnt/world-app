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

    // object: nilで購読しているため、webview以外が出したキーボードの通知も届く。
    // 特にアカウント作成フローはアプリ内ブラウザ(SFSafariViewController)の登録フォームに
    // 入力させるので、そのキーボード高さをそのまま流すとwebview側に余白が残り続け、
    // ブラウザを閉じた後に開いたBottomSheetの中身が高さ0に潰れて真っ白になる
    private func isOwnKeyboard(_ notification: Notification) -> Bool {
        // アプリ内ブラウザは別プロセスで動くのでisLocalがfalseになる。
        // キーが無い経路もあるため、取れない場合は自分のものとみなす
        if let isLocal = notification.userInfo?[UIResponder.keyboardIsLocalUserInfoKey] as? Bool, !isLocal {
            return false
        }

        // モーダルが乗っている間(アプリ内ブラウザ/バーコードスキャナ等)はwebviewが隠れており、
        // そこで出たキーボードはこちらのレイアウトには関係ない
        if manager.viewController?.presentedViewController != nil {
            return false
        }

        return true
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
        // 自分以外のキーボードは無視(return)ではなく高さ0として流す。
        // 無視すると直前の高さがJS側のstateに残り続けてしまう
        let height =
            isOwnKeyboard(notification)
            ? max(0, UIScreen.main.bounds.maxY - endFrame.minY)
            : 0

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
