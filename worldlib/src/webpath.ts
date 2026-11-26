import { IsCCID } from '@concrnt/client'

// webクライアント(concrnt.world)のパス。<id> は <ccid> か @<alias>
//   プロフィール: /<id>[/profile/<name>]
//   投稿:         /<id>[/profile/<name>]/post/<postId>

export const profilePath = (ccid: string, profileName?: string | null, alias?: string): string =>
    '/' +
    (alias ? '@' + alias : ccid) +
    (profileName && profileName !== 'main' ? '/profile/' + encodeURIComponent(profileName) : '')

// 標準キー(cckv://<ccid>/concrnt.world/profiles/<name>/posts/<postId>)以外の投稿(AP/atprotoのinboxキー等)は
// 短縮形に落とせないので /post/<encoded uri> で表す
export const postPath = (uri: string, alias?: string): string => {
    const m = uri.match(/^cckv:\/\/([^/]+)\/concrnt\.world\/profiles\/([^/]+)\/posts\/([^/]+)$/)
    if (!m || !IsCCID(m[1])) return '/post/' + encodeURIComponent(uri)
    return profilePath(m[1], m[2], alias) + '/post/' + encodeURIComponent(m[3])
}

export const parseWebPath = (pathname: string): { id: string; profileName?: string; postId?: string } | undefined => {
    const m = pathname.match(/^\/([^/]+)(?:\/profile\/([^/]+))?(?:\/post\/([^/]+))?$/)
    if (!m) return undefined
    try {
        const id = decodeURIComponent(m[1])
        if (!IsCCID(id) && !id.startsWith('@')) return undefined
        return {
            id,
            profileName: m[2] && decodeURIComponent(m[2]),
            postId: m[3] && decodeURIComponent(m[3])
        }
    } catch {
        return undefined
    }
}
