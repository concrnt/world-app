import { invoke } from '@tauri-apps/api/core'

export async function getItem(key: string): Promise<string | null> {
  return await invoke<{password?: string}>('plugin:keychain|get_item', {
		key,
  }).then((r) => (r.password ? r.password : null));
}

export async function saveItem(key: string, password: string): Promise<any | null> {
  return await invoke('plugin:keychain|save_item', {
		key,
		password
  });
}

export async function removeItem(key: string): Promise<any | null> {
  return await invoke('plugin:keychain|remove_item', {
		key,
  });
}
