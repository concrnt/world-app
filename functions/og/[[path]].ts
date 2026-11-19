// クローラー向けOGP HTML生成 (Cloudflare Pages Functions)
// Cloudflare側のルールでbot UAを /og/<元パス> にrewriteする前提。対象は
//   /og/profile/<ccid>[/<profile>]
//   /og/post/<encoded cckv uri>
//   /og/timeline/<encoded cckv uri>
//   /og/lists/<encoded cckv uri>
// 取得できないものは元パスへ302で戻す(キャッシュしない)。
//
// Discord は activity+json の alternate link を見つけると Note と attributedTo の Person を読んで
// アバター・著者名・投稿日時を埋め込む(未文書化)。投稿にはAP表現が無いので読み取り専用の疑似オブジェクトを返す
//   /og/ap/post/<encoded cckv uri>   Note
//   /og/ap/author/<encoded cckv uri> Person(その投稿における著者。profileOverride を反映するため投稿単位)

const CACHE_TTL_SECONDS = 21600
const DEFAULT_ENTRYPOINT = 'ariake.concrnt.net'
const SITE_NAME = 'Concrnt'
const THEME_COLOR = '#0476d9'
const DESCRIPTION_LIMIT = 300
const IS_CCID = /^con1[^.]{38}$/
const AS_CONTEXT = 'https://www.w3.org/ns/activitystreams'
const AS_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'

interface Env {
    OG_ENTRYPOINT?: string
}

interface Image {
    url: string
    mediaType: string
}

interface Post {
    uri: string
    ccid: string
    profileName: string
    alias?: string
    username: string
    avatar?: string
    body: string
    images: Image[]
    hidden: number
    createdAt?: string
}

const baseURL = (host: string): string =>
    host.startsWith('localhost') || host.startsWith('127.') ? `http://${host}` : `https://${host}`

const escapeAttr = (unsafe: unknown): string =>
    typeof unsafe === 'string'
        ? unsafe
              .replaceAll(/&/g, '&amp;')
              .replaceAll(/</g, '&lt;')
              .replaceAll(/>/g, '&gt;')
              .replaceAll(/"/g, '&quot;')
              .replaceAll(/'/g, '&#039;')
        : ''

const IMAGE_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif'
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url)
    const isDiscord = /discordbot/i.test(context.request.headers.get('user-agent') ?? '')
    // alternate link は Discord にだけ出すので HTML の内容が UA で変わる。Cache API はフラグメントを無視するのでクエリで分ける
    const cacheKey = url.origin + url.pathname + (isDiscord ? '?ua=discord' : '')
    const originalPath = url.origin + url.pathname.replace(/^\/og/, '')
    const redirect = (): Response => Response.redirect(originalPath, 302)

    const cache = caches.default
    const cached = await cache.match(cacheKey)
    if (cached) return cached

    const entrypoint = context.env.OG_ENTRYPOINT ?? DEFAULT_ENTRYPOINT

    // GET /api/v2/resolve?uri=... は認証不要でSignedDocumentを返す。documentは二段パース
    const resolve = async (domain: string, uri: string): Promise<Record<string, any> | undefined> => {
        try {
            const response = await fetch(`${baseURL(domain)}/api/v2/resolve?uri=${encodeURIComponent(uri)}`, {
                headers: { Accept: 'application/json' }
            })
            if (!response.ok) return undefined
            const body: any = await response.json()
            if (typeof body.document !== 'string') return undefined
            return JSON.parse(body.document)
        } catch {
            return undefined
        }
    }

    // ccfs://はクローラーが取得できないのでresolveエンドポイント(303でファイルへ)に変換する
    const imageURL = (domain: string, src: unknown): string | undefined => {
        if (typeof src !== 'string' || src === '') return undefined
        if (src.startsWith('ccfs://')) return `${baseURL(domain)}/api/v2/resolve?uri=${encodeURIComponent(src)}`
        return src
    }

    const segments = url.pathname
        .replace(/^\/og\/?/, '')
        .split('/')
        .filter((s) => s !== '')
        .map((s) => {
            try {
                return decodeURIComponent(s)
            } catch {
                return s
            }
        })
    const [kind, ...rest] = segments

    // cckv://<owner>[@hint]/<key...> を分解する。timelineはownerがFQDN
    const parseUri = (raw: string | undefined): { owner: string; hint?: string; key: string } | undefined => {
        const m = raw?.match(/^cckv:\/\/([^/@]+)(?:@([^/]+))?(\/.*)?$/)
        if (!m) return undefined
        return { owner: m[1], hint: m[2], key: m[3] ?? '' }
    }

    // ownerの所属ドメインを解決する。CCIDならentity経由、それ以外(FQDN)はそのまま
    const resolveEntity = async (
        owner: string,
        hint?: string
    ): Promise<{ domain: string; alias?: string } | undefined> => {
        if (!IS_CCID.test(owner)) return { domain: owner }
        const entity = await resolve(hint ?? entrypoint, `cckv://${owner}`)
        const domain = entity?.value?.domain
        if (typeof domain !== 'string' || domain === '') return undefined
        const alias = entity?.value?.alias
        return { domain, alias: typeof alias === 'string' && alias !== '' ? alias : undefined }
    }

    const loadPost = async (raw: string | undefined): Promise<Post | undefined> => {
        const parsed = parseUri(raw)
        if (!parsed || !IS_CCID.test(parsed.owner)) return undefined
        const entity = await resolveEntity(parsed.owner, parsed.hint)
        if (!entity) return undefined
        const { domain } = entity
        const post = await resolve(domain, `cckv://${parsed.owner}${parsed.key}`)
        if (!post) return undefined
        const value = post.value ?? {}

        // worldlib Message.load と同じ順: 投稿先プロフィール → profileOverride で上書き
        // key: /concrnt.world/profiles/<profile>/posts/<id>
        const profileName = parsed.key.split('/')[3] || 'main'
        const profile = await resolve(domain, `cckv://${parsed.owner}/concrnt.world/profiles/${profileName}`)
        let username: string = profile?.value?.username ?? ''
        let avatar: string | undefined = imageURL(domain, profile?.value?.avatar)
        if (value.profileOverride?.username) username = value.profileOverride.username
        if (value.profileOverride?.avatar) avatar = imageURL(domain, value.profileOverride.avatar)

        let body: string = typeof value.body === 'string' ? value.body : ''
        const imageRegex = /!\[[^\]]*\]\(([^)]*)\)/g
        const images: Image[] = []
        for (const m of body.matchAll(imageRegex)) {
            const src = imageURL(domain, m[1])
            if (!src) continue
            const ext = m[1].match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? ''
            images.push({ url: src, mediaType: IMAGE_TYPES[ext] ?? 'image/png' })
        }
        body = body.replace(imageRegex, '')

        let hidden = 0
        for (const media of Array.isArray(value.medias) ? value.medias : []) {
            if (typeof media?.mediaType !== 'string' || !media.mediaType.startsWith('image')) continue
            if (media.flag) {
                hidden++
                continue
            }
            const src = imageURL(domain, media.mediaURL)
            if (src) images.push({ url: src, mediaType: media.mediaType })
        }

        const createdAt =
            typeof post.createdAt === 'string' && !isNaN(Date.parse(post.createdAt)) ? post.createdAt : undefined

        return {
            uri: `cckv://${parsed.owner}${parsed.key}`,
            ccid: parsed.owner,
            profileName,
            alias: entity.alias,
            username,
            avatar,
            body,
            images,
            hidden,
            createdAt
        }
    }

    if (kind === 'ap' && rest.length === 2 && (rest[0] === 'post' || rest[0] === 'author')) {
        const json = (body: unknown, status = 200): Response => {
            const response = new Response(JSON.stringify(body), {
                status,
                headers: {
                    'Content-Type': 'application/activity+json; charset=utf-8',
                    'Cache-Control': `s-maxage=${CACHE_TTL_SECONDS}`
                }
            })
            if (status === 200) context.waitUntil(cache.put(cacheKey, response.clone()))
            return response
        }
        const post = await loadPost(rest[1])
        if (!post) return json({ error: 'not found' }, 404)
        const encoded = encodeURIComponent(post.uri)
        const author = `${url.origin}/og/ap/author/${encoded}`
        if (rest[0] === 'post') {
            return json({
                '@context': AS_CONTEXT,
                type: 'Note',
                id: `${url.origin}/og/ap/post/${encoded}`,
                url: `${url.origin}/post/${encoded}`,
                attributedTo: author,
                published: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
                to: [AS_PUBLIC],
                content: `<p>${escapeAttr(post.body).replaceAll('\n', '<br>')}</p>`,
                sensitive: post.hidden > 0,
                attachment: post.images.map((image) => ({
                    type: 'Document',
                    mediaType: image.mediaType,
                    url: image.url,
                    sensitive: false
                }))
            })
        }
        return json({
            '@context': AS_CONTEXT,
            type: 'Person',
            id: author,
            url: `${url.origin}/profile/${post.ccid}${post.profileName === 'main' ? '' : `/${post.profileName}`}`,
            name: post.username,
            preferredUsername: post.alias ?? post.ccid,
            icon: post.avatar ? { type: 'Image', url: post.avatar } : undefined
        })
    }

    let title = ''
    let description = ''
    let images: string[] = []
    let card = 'summary'
    let type = 'website'
    const extra: string[] = []

    if (kind === 'profile' && rest.length >= 1 && rest.length <= 2 && IS_CCID.test(rest[0])) {
        const [ccid, profileName = 'main'] = rest
        const entity = await resolveEntity(ccid)
        if (!entity) return redirect()
        const profile = await resolve(entity.domain, `cckv://${ccid}/concrnt.world/profiles/${profileName}`)
        if (!profile) return redirect()
        title = `${profile.value?.username ?? ''} on Concrnt`
        description = profile.value?.description ?? ''
        const avatar = imageURL(entity.domain, profile.value?.avatar)
        if (avatar) images = [avatar]
    } else if (kind === 'post' && rest.length === 1) {
        const post = await loadPost(rest[0])
        if (!post) return redirect()

        title = `${post.username} on Concrnt`
        description = post.body
        if (post.hidden > 0) description += ` (with ${post.hidden} hidden images)`
        images = post.images.map((image) => image.url)
        if (images.length > 0) {
            card = 'summary_large_image'
        } else if (post.avatar) {
            images = [post.avatar]
        }
        type = 'article'
        if (post.createdAt) {
            extra.push(`<meta property="og:pubdate" content="${escapeAttr(new Date(post.createdAt).toISOString())}">`)
        }
        if (isDiscord) {
            const href = `${url.origin}/og/ap/post/${encodeURIComponent(post.uri)}`
            extra.push(`<link rel="alternate" type="application/activity+json" href="${escapeAttr(href)}">`)
        }
    } else if (kind === 'timeline' && rest.length === 1) {
        const parsed = parseUri(rest[0])
        if (!parsed) return redirect()
        const entity = await resolveEntity(parsed.owner, parsed.hint)
        if (!entity) return redirect()
        const timeline = await resolve(entity.domain, `cckv://${parsed.owner}${parsed.key}`)
        if (!timeline) return redirect()
        title = timeline.value?.name ?? ''
        description = timeline.value?.description ?? ''
        const banner = imageURL(entity.domain, timeline.value?.banner)
        const icon = imageURL(entity.domain, timeline.value?.icon)
        if (banner) {
            images = [banner]
            card = 'summary_large_image'
        } else if (icon) {
            images = [icon]
        }
    } else if (kind === 'lists' && rest.length === 1) {
        const parsed = parseUri(rest[0])
        if (!parsed || !IS_CCID.test(parsed.owner)) return redirect()
        const entity = await resolveEntity(parsed.owner, parsed.hint)
        if (!entity) return redirect()
        const list = await resolve(entity.domain, `cckv://${parsed.owner}${parsed.key}`)
        if (!list) return redirect()
        title = list.value?.name ?? ''
        description = list.value?.description ?? ''
        const icon = imageURL(entity.domain, list.value?.iconURL)
        if (icon) images = [icon]
    } else {
        return redirect()
    }

    if (images.length === 0) images = [`${url.origin}/concrnt.png`]
    if (description.length > DESCRIPTION_LIMIT) description = description.slice(0, DESCRIPTION_LIMIT) + '…'

    const safeTitle = escapeAttr(title)
    const safeDescription = escapeAttr(description)
    const safePath = escapeAttr(originalPath)

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:type" content="${type}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:url" content="${safePath}">
${images.map((src) => `    <meta property="og:image" content="${escapeAttr(src)}">`).join('\n')}
    <meta property="twitter:card" content="${card}">
    <meta name="theme-color" content="${THEME_COLOR}">
    <link rel="icon" href="${url.origin}/favicon.ico">
    <link rel="canonical" href="${safePath}">
${extra.map((line) => `    ${line}`).join('\n')}
    <script>window.location.href = ${JSON.stringify(originalPath).replaceAll('<', '\\u003c')}</script>
  </head>
</html>
`

    const response = new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': `s-maxage=${CACHE_TTL_SECONDS}`
        }
    })
    context.waitUntil(cache.put(cacheKey, response.clone()))
    return response
}
