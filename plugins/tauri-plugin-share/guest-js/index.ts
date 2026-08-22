import { invoke } from '@tauri-apps/api/core'

export interface ShareTextOptions {
  text: string
  title?: string
}

export async function shareText(options: ShareTextOptions): Promise<void> {
  await invoke<void>('plugin:share|share_text', { payload: options })
}
