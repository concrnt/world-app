# Tauri keychain plugin

This plugin is used to hold keys or password, and even after uninstalling and reinstalling your app, they still exist
- ios: impl of Keychain services and your need xcode add Signing & Capabilities - Keychain Sharing
- android: impl of AccountManager

## get keychain
```typescript
import { getItem } from 'tauri-plugin-keychain'
getItem(key)
```
- or
```typescript
import { invoke } from '@tauri-apps/api/core'
invoke('plugin:keychain|get_item', {
	key
})
```

## save keychain
```typescript
import { saveItem } from 'tauri-plugin-keychain'
saveItem(key, password)
```
- or
```typescript
import { invoke } from '@tauri-apps/api/core'
invoke('plugin:keychain|save_item', {
	key,
	password
})
```

## remove keychain
```typescript
import { removeItem } from 'tauri-plugin-keychain'
removeItem(key)
```
- or
```typescript
import { invoke } from '@tauri-apps/api/core'
invoke('plugin:keychain|remove_item', {
	key
})
```