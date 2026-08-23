// 鍵を持たない状態(ゲスト閲覧・ログイン・サインアップ)で最初に問い合わせるサーバー。
// concrnt.worldはアプリ配信ホストでありconcrntサーバーではないため、localhostと同様にariakeへ向ける
export const resolveEntrypoint = (): string => {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === 'concrnt.world') {
        return 'ariake.concrnt.net'
    }
    return hostname
}
