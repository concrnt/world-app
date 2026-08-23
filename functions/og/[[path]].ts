// クローラー向けOGP HTML生成 (Cloudflare Pages Functions)
// Cloudflare側のルールでbot UAを /og/<元パス> にrewriteする前提。対象は
//   /og/profile/<ccid>[/<profile>]
//   /og/post/<encoded cckv uri>
//   /og/timeline/<encoded cckv uri>
//   /og/lists/<encoded cckv uri>
// 取得できないものは元パスへ302で戻す(キャッシュしない)。

const CACHE_TTL_SECONDS = 21600
const DEFAULT_ENTRYPOINT = 'ariake.concrnt.net'
const THEME_COLOR = '#0476d9'
const DESCRIPTION_LIMIT = 300
const IS_CCID = /^con1[^.]{38}$/

interface Env {
    OG_ENTRYPOINT?: string
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

export const onRequest: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url)
    const cacheKey = url.origin + url.pathname
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
    const resolveDomain = async (owner: string, hint?: string): Promise<string | undefined> => {
        if (!IS_CCID.test(owner)) return owner
        const entity = await resolve(hint ?? entrypoint, `cckv://${owner}`)
        const domain = entity?.value?.domain
        return typeof domain === 'string' && domain !== '' ? domain : undefined
    }

    let title = ''
    let description = ''
    let images: string[] = []
    let card = 'summary'

    if (kind === 'profile' && rest.length >= 1 && rest.length <= 2 && IS_CCID.test(rest[0])) {
        const [ccid, profileName = 'main'] = rest
        const domain = await resolveDomain(ccid)
        if (!domain) return redirect()
        const profile = await resolve(domain, `cckv://${ccid}/concrnt.world/profiles/${profileName}`)
        if (!profile) return redirect()
        title = `${profile.value?.username ?? ''} on Concrnt`
        description = profile.value?.description ?? ''
        const avatar = imageURL(domain, profile.value?.avatar)
        if (avatar) images = [avatar]
    } else if (kind === 'post' && rest.length === 1) {
        const parsed = parseUri(rest[0])
        if (!parsed || !IS_CCID.test(parsed.owner)) return redirect()
        const domain = await resolveDomain(parsed.owner, parsed.hint)
        if (!domain) return redirect()
        const post = await resolve(domain, `cckv://${parsed.owner}${parsed.key}`)
        if (!post) return redirect()
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
        images = Array.from(body.matchAll(imageRegex), (m) => imageURL(domain, m[1])).filter(
            (s): s is string => s !== undefined
        )
        body = body.replace(imageRegex, '')

        let hidden = 0
        for (const media of Array.isArray(value.medias) ? value.medias : []) {
            if (typeof media?.mediaType !== 'string' || !media.mediaType.startsWith('image')) continue
            if (media.flag) {
                hidden++
                continue
            }
            const src = imageURL(domain, media.mediaURL)
            if (src) images.push(src)
        }
        if (hidden > 0) body += ` (with ${hidden} hidden images)`

        title = `${username} on Concrnt`
        description = body
        if (images.length > 0) {
            card = 'summary_large_image'
        } else if (avatar) {
            images = [avatar]
        }
    } else if (kind === 'timeline' && rest.length === 1) {
        const parsed = parseUri(rest[0])
        if (!parsed) return redirect()
        const domain = await resolveDomain(parsed.owner, parsed.hint)
        if (!domain) return redirect()
        const timeline = await resolve(domain, `cckv://${parsed.owner}${parsed.key}`)
        if (!timeline) return redirect()
        title = timeline.value?.name ?? ''
        description = timeline.value?.description ?? ''
        const banner = imageURL(domain, timeline.value?.banner)
        const icon = imageURL(domain, timeline.value?.icon)
        if (banner) {
            images = [banner]
            card = 'summary_large_image'
        } else if (icon) {
            images = [icon]
        }
    } else if (kind === 'lists' && rest.length === 1) {
        const parsed = parseUri(rest[0])
        if (!parsed || !IS_CCID.test(parsed.owner)) return redirect()
        const domain = await resolveDomain(parsed.owner, parsed.hint)
        if (!domain) return redirect()
        const list = await resolve(domain, `cckv://${parsed.owner}${parsed.key}`)
        if (!list) return redirect()
        title = list.value?.name ?? ''
        description = list.value?.description ?? ''
        const icon = imageURL(domain, list.value?.iconURL)
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
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:url" content="${safePath}">
${images.map((src) => `    <meta property="og:image" content="${escapeAttr(src)}">`).join('\n')}
    <meta property="twitter:card" content="${card}">
    <meta name="theme-color" content="${THEME_COLOR}">
    <link rel="canonical" href="${safePath}">
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
