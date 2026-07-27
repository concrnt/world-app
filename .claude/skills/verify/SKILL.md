---
name: verify
description: world-appアプリ版(Tauriフロントエンド)をブラウザ+IPCモックでログイン済み検証する手順
---

# world-app アプリ版のブラウザ検証

実機なしでアプリ版(`app/`)をheadlessブラウザからログイン済み状態で検証する。

## 前提
- ローカルdevnet が `localhost:8000` で稼働(domain名: `cc2.tunnel.anthrotech.dev`)
- Playwright headless shell: `~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`(`playwright-core` をscratchpad等にnpm installして使う)

## 手順
1. **ビルドして preview で配信**(vite devはワークスペースパッケージをプリバンドルするため、client/worldlib/ui変更を含む検証は必ずビルド経由で):
   ```sh
   pnpm --filter @concrnt/client build   # 依存ライブラリを変更した場合
   pnpm --filter world-app build
   pnpm --filter world-app preview --port 4175
   ```
2. **署名サーバー**: node で `client/dist/cjs` の `Sign`/`ComputeCKID` を使うHTTPサーバー(CORSヘッダ必須)。ブラウザ内のIPCモックが `sign_subkey`/`sign_masterkey` をここへ転送する。`sign_subkey` の戻り値は `[signature, ckid]` のタプル。
3. **Playwright側**:
   - `addInitScript` で `window.__TAURI_INTERNALS__` をモック: `invoke('get_session')` → `{ccid, ckid, domain}`、`sign_subkey`/`sign_masterkey` → 署名サーバーへfetch、`transformCallback` スタブ必須、未知コマンドは `null`
   - `ctx.route('**://cc2.tunnel.anthrotech.dev/**')` で `http://localhost:8000` に書き換え(`ctx.request.fetch` → `route.fulfill`)
   - wss は書き換え不可で失敗するが、`newTimelineReader` が `withoutSocket` にフォールバックするので実害なし(=realtime系の検証はこの環境では不可)
4. **タブ操作**: 下部タブバーは `[data-testid="tab-layout"] > *:last-child button` の4つ(home, explorer, notifications, contacts の順)。

## タブ切替時のActivity保持の検証ポイント
- タブ復帰後にコンソールへ `Initializing timeline reader` / `Listen!!!!` が**再出力されないこと**(readerが再アタッチされている証拠)
- スクロールコンテナ(overflow-y:auto のdiv)の scrollTop が復帰後も維持されること
- 注意: Activityのhidden(`display:none`)中はブラウザが内側スクロール位置を破棄するため、各Timelineコンポーネントは `scrollPositionRef` + rAF再試行つき `useLayoutEffect` で復元している(この復元はdisplay復帰後の数フレーム以内に完了する)

## テストアカウント / seed
- 使い捨て鍵・再登録手順・seed投稿スクリプトはユーザーのメモリ `world-app-tauri-app-browser-verification` / `world-app-web-verification-setup` 参照(devnetはリセットされることがある。同じ鍵で再登録すればセッション再利用可)
