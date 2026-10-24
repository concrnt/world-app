// 他の端末のログイン (signal) のリンク表記。
//
//   concrnt-auth://signal/<host>/<path>   ==   wss://<host>/<path>
//
// web のログイン画面が出す QR は今のところ wss://signal.concrnt.net/<uuid> そのものだが、
// 今後は CIP-17 と同じ concrnt-auth:// スキームに寄せて deep link でも開けるようにする。
// その第一歩として、アプリはどちらの表記も受け付ける (UI は共通)。
export const SIGNAL_URI_PREFIX = 'concrnt-auth://signal/'

/**
 * QR / deep link の文字列から signal チャンネルの WebSocket URL を取り出す。
 * signal のリンクでなければ null、signal の形だが不正なら throw
 */
export const parseSignalLoginUri = (text: string): string | null => {
    let hostAndPath: string
    if (text.startsWith(SIGNAL_URI_PREFIX)) {
        hostAndPath = text.slice(SIGNAL_URI_PREFIX.length)
    } else if (text.startsWith('wss://')) {
        hostAndPath = text.slice('wss://'.length)
    } else {
        return null
    }

    // <host>/<path>: host は空でなく userinfo を含まない。パスは必須 (チャンネル ID)
    const pathStart = hostAndPath.indexOf('/')
    if (pathStart <= 0 || /[@\\]/.test(hostAndPath.slice(0, pathStart))) {
        throw new Error('invalid signal login uri')
    }
    let url: URL
    try {
        url = new URL('wss://' + hostAndPath)
    } catch {
        throw new Error('invalid signal login uri')
    }
    if (url.pathname === '/' || url.hash !== '') throw new Error('invalid signal login uri')
    return url.href
}
