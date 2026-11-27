import { useEffect, useState } from 'react'
import type { IconType } from 'react-icons'
import { MdLink } from 'react-icons/md'
import {
    SiApplemusic,
    SiBandcamp,
    SiBluesky,
    SiBuymeacoffee,
    SiDiscord,
    SiFacebook,
    SiGithub,
    SiGitlab,
    SiInstagram,
    SiItchdotio,
    SiKofi,
    SiLine,
    SiNiconico,
    SiNote,
    SiPatreon,
    SiPinterest,
    SiPixiv,
    SiQiita,
    SiReddit,
    SiSoundcloud,
    SiSpotify,
    SiSteam,
    SiTelegram,
    SiThreads,
    SiTiktok,
    SiTumblr,
    SiTwitch,
    SiX,
    SiYoutube,
    SiZenn
} from 'react-icons/si'
import { useUrlSummary } from '../contexts/UrlSummary'
import { useMediaProxy } from '../contexts/MediaProxy'

// ホスト名(www. を除く)そのもの、またはそのサブドメインに一致したらブランドアイコンを使う。
// 2 つ目は URL からユーザー名を取り出す関数で、無いサービスや取り出せない URL はドメイン名を表示する。
// Mastodon/Misskey のようにホストが決まらないサービスは載せない(favicon に任せる)
type Username = (url: URL) => string | undefined
// パスの n 番目の要素(/a/b の a が 1)。先頭の @ は落とす
const seg =
    (n: number): Username =>
    (url) =>
        decodeURIComponent(url.pathname.split('/')[n] ?? '').replace(/^@/, '') || undefined
// /<prefix>/<name> の形だけを受ける
const after =
    (...prefixes: string[]): Username =>
    (url) =>
        prefixes.includes(url.pathname.split('/')[1]) ? seg(2)(url) : undefined
// <name>.example.com
const subdomain: Username = (url) =>
    url.hostname
        .replace(/^www\./, '')
        .split('.')
        .slice(0, -2)[0]

const brands: Record<string, [IconType, Username?]> = {
    'github.com': [SiGithub, seg(1)],
    'gitlab.com': [SiGitlab, seg(1)],
    'x.com': [SiX, seg(1)],
    'twitter.com': [SiX, seg(1)],
    // /@handle だけ。/channel/<id> や /watch はユーザー名にならない
    'youtube.com': [SiYoutube, (url) => (url.pathname.startsWith('/@') ? seg(1)(url) : undefined)],
    'youtu.be': [SiYoutube],
    'twitch.tv': [SiTwitch, seg(1)],
    'instagram.com': [SiInstagram, seg(1)],
    'threads.net': [SiThreads, seg(1)],
    'threads.com': [SiThreads, seg(1)],
    'facebook.com': [SiFacebook, seg(1)],
    'tiktok.com': [SiTiktok, seg(1)],
    'bsky.app': [SiBluesky, after('profile')],
    'discord.gg': [SiDiscord],
    'discord.com': [SiDiscord],
    'pixiv.net': [SiPixiv],
    'note.com': [SiNote, seg(1)],
    'zenn.dev': [SiZenn, seg(1)],
    'qiita.com': [SiQiita, seg(1)],
    'nicovideo.jp': [SiNiconico],
    'steamcommunity.com': [SiSteam, after('id')],
    'steampowered.com': [SiSteam],
    'spotify.com': [SiSpotify],
    'soundcloud.com': [SiSoundcloud, seg(1)],
    'music.apple.com': [SiApplemusic],
    'bandcamp.com': [SiBandcamp, subdomain],
    'itch.io': [SiItchdotio, subdomain],
    'line.me': [SiLine],
    't.me': [SiTelegram, seg(1)],
    'reddit.com': [SiReddit, after('user', 'u')],
    'tumblr.com': [SiTumblr, (url) => subdomain(url) ?? seg(1)(url)],
    'pinterest.com': [SiPinterest, seg(1)],
    'patreon.com': [SiPatreon, seg(1)],
    'ko-fi.com': [SiKofi, seg(1)],
    'buymeacoffee.com': [SiBuymeacoffee, seg(1)]
}

const parse = (text: string): { url: URL; host: string; brand?: [IconType, Username?] } | undefined => {
    let url: URL
    try {
        url = new URL(text)
    } catch {
        return undefined
    }
    const host = url.hostname.replace(/^www\./, '')
    const key = Object.keys(brands).find((brand) => host === brand || host.endsWith('.' + brand))
    return { url, host, brand: key ? brands[key] : undefined }
}

// リンクの表示名。ブランドの URL からユーザー名が取れればそれ、取れなければドメイン名
export const linkLabel = (text: string): string => {
    const parsed = parse(text)
    if (!parsed) return text
    return parsed.brand?.[1]?.(parsed.url) ?? parsed.host
}

interface Props {
    url: string
    size: number
}

export const LinkIcon = (props: Props) => {
    const service = useUrlSummary()
    const { getImageURL } = useMediaProxy()
    const [favicon, setFavicon] = useState<string>()

    // 不正な URL はブランドにも favicon にも当たらず、既定のアイコンになる
    const Brand = parse(props.url)?.brand?.[0]

    useEffect(() => {
        if (Brand || !service) return
        let stale = false
        service.getSummary(props.url).then((summary) => {
            if (!stale) setFavicon(summary?.icon || undefined)
        })
        return () => {
            stale = true
        }
    }, [props.url, service, Brand])

    if (Brand) return <Brand size={props.size} style={{ flexShrink: 0 }} />
    if (favicon) {
        return (
            <img
                src={getImageURL(favicon, { maxWidth: 64 })}
                alt=""
                style={{ width: props.size, height: props.size, flexShrink: 0, objectFit: 'contain' }}
                onError={() => setFavicon(undefined)}
            />
        )
    }
    return <MdLink size={props.size} style={{ flexShrink: 0 }} />
}
