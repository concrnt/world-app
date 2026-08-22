import Foundation
import Tauri
import UIKit

private struct ShareTextArgs: Decodable {
  let text: String
  let title: String?
}

class SharePlugin: Plugin {
  @objc public func shareText(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ShareTextArgs.self)

    guard !args.text.isEmpty else {
      invoke.reject("text is required")
      return
    }

    DispatchQueue.main.async {
      guard let viewController = self.topViewController() else {
        invoke.reject("Unable to present share sheet")
        return
      }

      // URL文字列はURLとして渡すとシェア先アプリがリンクとして扱える
      let item: Any = URL(string: args.text).flatMap { $0.scheme != nil ? $0 : nil } ?? args.text
      let controller = UIActivityViewController(activityItems: [item], applicationActivities: nil)
      if let popover = controller.popoverPresentationController {
        popover.sourceView = viewController.view
        popover.sourceRect = CGRect(
          x: viewController.view.bounds.midX,
          y: viewController.view.bounds.midY,
          width: 0,
          height: 0
        )
        popover.permittedArrowDirections = []
      }
      viewController.present(controller, animated: true)
      invoke.resolve()
    }
  }

  private func topViewController() -> UIViewController? {
    var current = manager.viewController

    while let presented = current?.presentedViewController {
      current = presented
    }

    return current
  }
}

@_cdecl("init_plugin_share")
func initPlugin() -> Plugin {
  return SharePlugin()
}
