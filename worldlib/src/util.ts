export function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
    return result.status === 'fulfilled'
}

export function isNonNull<T>(value: T | null): value is T {
    return value !== null
}

export function isNonNullOrUndefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
}

// http(s)のmanifest URLで指定される静的chunklineタイムライン。cckvの作成物ではないので
// ドキュメント解決・投稿・リアルタイム購読の対象外で、読み出しはサーバーのtimeline APIにそのまま渡す
export function isStaticTimelineURI(uri: string): boolean {
    return uri.startsWith('https://') || uri.startsWith('http://')
}

// 静的タイムラインの表示名: ホスト+manifestのあるディレクトリ(末尾のファイル名は落とす)
export function staticTimelineLabel(uri: string): string {
    try {
        const url = new URL(uri)
        const dir = url.pathname.replace(/\/[^/]*$/, '')
        return url.host + dir
    } catch {
        return uri
    }
}
