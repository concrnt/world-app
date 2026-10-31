export function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
    return result.status === 'fulfilled'
}

export function isNonNull<T>(value: T | null): value is T {
    return value !== null
}

export function isNonNullOrUndefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
}

// 外部入力 (クエリパラメータ、リモートの文書、CFM/Bluesky/AP 由来のリンク) をナビゲーション先
// (href / window.open / openUrl / location.href) に使う前の検証。http/https 以外 (javascript:, data:,
// 独自スキーム, 相対URL) と parse できない文字列は null。成功時は入力文字列をそのまま返す
// (URL オブジェクトで再構成すると表示や送信先が意図せず正規化されるため)
export function safeHttpUrl(text: string | null | undefined): string | null {
    if (!text) return null
    try {
        const url = new URL(text)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
        return text
    } catch {
        return null
    }
}

// http(s)のmanifest URLで指定される静的chunklineタイムライン。cckvの作成物ではないので
// ドキュメント解決・投稿・リアルタイム購読の対象外で、読み出しはサーバーのtimeline APIにそのまま渡す
export function isStaticTimelineURI(uri: string): boolean {
    return uri.startsWith('https://') || uri.startsWith('http://')
}

// 静的タイムラインの表示名: ホスト+manifestのあるディレクトリ(末尾のファイル名は落とす)。
// パスは表示用にパーセントデコードする(日本語のディレクトリ名が%E3...で出ないように)
export function staticTimelineLabel(uri: string): string {
    try {
        const url = new URL(uri)
        const dir = url.pathname.replace(/\/[^/]*$/, '')
        let decoded = dir
        try {
            decoded = decodeURIComponent(dir)
        } catch {
            // 壊れたエンコードはそのまま出す
        }
        return url.host + decoded
    } catch {
        return uri
    }
}
