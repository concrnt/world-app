import { invoke } from '@tauri-apps/api/core'

// OSのシェアシート(iOS: UIActivityViewController / Android: ACTION_SEND chooser)を開く。
// Android WebViewはnavigator.share非対応なのでpluginで実装している
export const shareText = (text: string, title?: string): Promise<void> =>
    invoke<void>('plugin:share|share_text', { payload: { text, title } })
