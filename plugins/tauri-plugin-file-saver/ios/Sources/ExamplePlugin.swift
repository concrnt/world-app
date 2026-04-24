import Foundation
import Tauri
import UIKit

private struct SaveTextFileArgs: Decodable {
  let fileName: String
  let content: String
  let mimeType: String?
}

private struct SaveTextFileResponse: Encodable {
  let uri: String
}

private final class FileSavePickerDelegate: NSObject, UIDocumentPickerDelegate {
  weak var plugin: FileSaverPlugin?

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    plugin?.completeSave(with: urls.first)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    plugin?.failPendingSave(message: "Save cancelled")
  }
}

class FileSaverPlugin: Plugin {
  private let pickerDelegate = FileSavePickerDelegate()
  private var pendingInvoke: Invoke?
  private var pendingTempDirectory: URL?

  override init() {
    super.init()
    pickerDelegate.plugin = self
  }

  @objc public func saveTextFile(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SaveTextFileArgs.self)
    let fileName = args.fileName.trimmingCharacters(in: .whitespacesAndNewlines)
    _ = args.mimeType

    guard !fileName.isEmpty else {
      invoke.reject("fileName is required")
      return
    }

    guard pendingInvoke == nil else {
      invoke.reject("Another save operation is already in progress")
      return
    }

    let fileManager = FileManager.default
    let tempDirectory = fileManager.temporaryDirectory
      .appendingPathComponent("tauri-plugin-file-saver-\(UUID().uuidString)", isDirectory: true)
    let tempFile = tempDirectory.appendingPathComponent((fileName as NSString).lastPathComponent)

    try fileManager.createDirectory(
      at: tempDirectory,
      withIntermediateDirectories: true,
      attributes: nil
    )
    try args.content.write(to: tempFile, atomically: true, encoding: .utf8)

    pendingInvoke = invoke
    pendingTempDirectory = tempDirectory

    DispatchQueue.main.async {
      guard let viewController = self.manager.viewController else {
        self.failPendingSave(message: "Unable to present document picker")
        return
      }

      let picker = UIDocumentPickerViewController(url: tempFile, in: .exportToService)
      picker.delegate = self.pickerDelegate
      picker.modalPresentationStyle = .fullScreen
      viewController.present(picker, animated: true)
    }
  }

  fileprivate func completeSave(with destinationURL: URL?) {
    guard let destinationURL else {
      failPendingSave(message: "No destination was selected")
      return
    }

    guard let invoke = pendingInvoke else {
      cleanupPendingFiles()
      return
    }

    pendingInvoke = nil
    cleanupPendingFiles()
    invoke.resolve(SaveTextFileResponse(uri: destinationURL.absoluteString))
  }

  fileprivate func failPendingSave(message: String) {
    guard let invoke = pendingInvoke else {
      cleanupPendingFiles()
      return
    }

    pendingInvoke = nil
    cleanupPendingFiles()
    invoke.reject(message)
  }

  private func cleanupPendingFiles() {
    defer { pendingTempDirectory = nil }

    guard let pendingTempDirectory else {
      return
    }

    try? FileManager.default.removeItem(at: pendingTempDirectory)
  }
}

@_cdecl("init_plugin_file_saver")
func initPlugin() -> Plugin {
  return FileSaverPlugin()
}
