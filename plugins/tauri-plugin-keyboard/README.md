# tauri-plugin-keyboard

OSのソフトウェアキーボードの表示状態と高さをwebviewに通知するプラグイン。

`visualViewport` の `resize` はキーボードが完全に表示された後に発火するため追従が遅れるが、
このプラグインはネイティブのイベントを使うことでアニメーション開始前に通知する。

- **iOS**: `UIResponder.keyboardWillChangeFrameNotification` を監視。最終フレームの高さと
  アニメーション時間をアニメーション開始前に取得できる。
- **Android**: `WindowInsetsCompat.Type.ime()` のインセットを監視
  (targetSdk 35+ のedge-to-edge強制環境では adjustResize が機能しないため必須)。

## イベント

`keyboardChange`

```ts
{
    visible: boolean
    height: number   // キーボードとwebview下端の重なり(CSS px, 非表示時0。iOSではsafe-area下端を含む)
    duration: number // OSのキーボードアニメーション時間(秒, Androidでは0)
}
```

## 使い方 (JS)

```ts
import { addPluginListener } from '@tauri-apps/api/core'

const listener = await addPluginListener('keyboard', 'keyboardChange', (payload) => {
    // ...
})
// 解除: await listener.unregister()
```

capabilities に `keyboard:default` の追加が必要。
