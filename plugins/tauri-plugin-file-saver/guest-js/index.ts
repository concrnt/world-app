import { invoke } from '@tauri-apps/api/core'

export interface SaveTextFileOptions {
  fileName: string
  content: string
  mimeType?: string
}

interface SaveTextFileResponse {
  uri: string
}

export async function saveTextFile(options: SaveTextFileOptions): Promise<string> {
  return await invoke<SaveTextFileResponse>('plugin:file-saver|save_text_file', {
    payload: options,
  }).then((response) => response.uri)
}
