# Concrnt World-App

このレポジトリは、concrntバージョン2のモバイルアプリおよびウェブアプリのプロジェクトを管理しています。

## 内訳
- client: concrntのサーバーとやりとりするローレベルなクライアントコード
- worldlib: concrntをSNSとして利用するため、clientをより高レベルなAPIでラップしたライブラリコード
- ui: モバイルアプリとウェブアプリで共通して利用するUIコンポーネントコード
- app: モバイルアプリのフロントエンドコード
- src-tauri: appと連携するTauriのコード
- plugins: Tauriのプラグイン
- web: webアプリのフロントエンドコード

## ビルド方法

### 事前準備
[tauriのセットアップ](https://v2.tauri.app/ja/start/prerequisites/)を済ませます

### Andoird

```
# 開発
$ pnpm tauri android dev

# 本番ビルド
$ pnpm tauri android build
```

ビルドする際は`/src-tauri/gen/android/keystore.properties`に署名の設定を追加する必要があります。
```
password=<password>
keyAlias=<keyAlias>
storeFile=<jksファイルのパス>
```

### iOS

```
# 開発
$ pnpm tauri ios dev
# 本番ビルド
$ pnpm tauri ios build
```

本番ビルドはApple Developerの署名設定が必要かも

