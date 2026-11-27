import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IsCCID } from '@concrnt/client'
import { Avatar, CssVar, Text } from '@concrnt/ui'
import { Client, ProfileLinksSchema, ProfileSchema, profilePath, safeHttpUrl, semantics, User } from '@concrnt/worldlib'
import { GuestClientProvider } from '../contexts/Client'
import { UrlSummaryProvider } from '../contexts/UrlSummary'
import { ExternalLink } from '../components/ExternalLink'
import { LinkIcon, linkLabel } from '../components/LinkIcon'
import { LoadingFull } from '../components/LoadingFull'
import { resolveEntrypoint } from '../utils/entrypoint'

interface Loaded {
    client: Client
    user: User
    profile: ProfileSchema
    links: ProfileLinksSchema['links']
}

// リンク集の単独ページ(https://concrnt.world/<id>[/profile/<name>]/links)。
// SNS の外に貼られる前提なので、ログイン中でもアプリのシェルに入れずゲストクライアントで出す
export const LinksPage = () => {
    const { t } = useTranslation('', { keyPrefix: 'web.links' })
    const { id = '', profile: profileName = 'main' } = useParams()
    const [searchParams] = useSearchParams()
    const hintParam = searchParams.get('hint') ?? undefined
    // undefined: ロード中 / null: 取得失敗
    const [loaded, setLoaded] = useState<Loaded | null>()

    useEffect(() => {
        let client: Client | undefined
        let cancelled = false
        const load = async () => {
            const guest = await Client.createAsGuest(hintParam ?? resolveEntrypoint())
            client = guest
            let ccid = id
            let hint = hintParam
            if (id.startsWith('@')) {
                const entity = await guest.api.getEntity(id)
                ccid = entity.author
                hint = entity.value.domain
            }
            if (!IsCCID(ccid)) throw new Error('invalid id: ' + id)
            const user = await User.load(guest, ccid, hint)
            const profile = await guest.api.getDocument<ProfileSchema>(
                semantics.profile(ccid, profileName),
                user.domain
            )
            // リンク集の文書が無いプロフィールも、Concrnt へのリンクだけのリンク集として出す
            const links = await guest.api
                .getDocument<ProfileLinksSchema>(semantics.links(ccid, profileName), user.domain)
                .then(
                    (doc) => doc.value.links,
                    () => []
                )
            if (cancelled) return
            // 他人の文書は外部入力で、形が違う要素を描画するとページごと落ちるので、http(s) の URL だけ出す
            setLoaded({
                client: guest,
                user,
                profile: profile.value,
                links: links.filter((link) => safeHttpUrl(link?.url))
            })
        }
        load().catch((err) => {
            console.error('Failed to load links', err)
            if (!cancelled) setLoaded(null)
        })
        return () => {
            cancelled = true
            client?.dispose()
        }
    }, [id, profileName, hintParam])

    if (loaded === undefined) return <LoadingFull />

    const pageStyle = {
        minHeight: '100dvh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: CssVar.space(4),
        padding: `calc(env(safe-area-inset-top) + ${CssVar.space(8)}) ${CssVar.space(4)} calc(env(safe-area-inset-bottom) + ${CssVar.space(4)})`,
        backgroundColor: CssVar.backdropBackground,
        color: CssVar.backdropText
    } as const

    if (loaded === null)
        return (
            <div style={pageStyle}>
                <meta name="robots" content="noindex" />
                <Text style={{ color: CssVar.backdropText }}>{t('notFound')}</Text>
            </div>
        )

    const username = loaded.profile.username ?? 'Anonymous'
    const path = profilePath(loaded.user.ccid, profileName, loaded.user.alias)

    const buttonStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: CssVar.space(2),
        padding: CssVar.space(3),
        borderRadius: CssVar.round(2),
        backgroundColor: CssVar.contentBackground,
        color: CssVar.contentText,
        textDecoration: 'none',
        fontWeight: 700,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
    } as const
    // 右側にアイコンと同じ幅の余白を取り、表示名をボタンの中央に置く
    const labelStyle = {
        flex: 1,
        textAlign: 'center',
        overflowWrap: 'anywhere',
        paddingRight: `calc(24px + ${CssVar.space(2)})`
    } as const

    return (
        <div style={pageStyle}>
            <title>{`${username} - Concrnt`}</title>
            <meta name="description" content={loaded.profile.description ?? ''} />
            <link rel="canonical" href={'https://concrnt.world' + path + '/links'} />

            <Avatar
                ccid={loaded.user.ccid}
                src={loaded.profile.avatar}
                style={{ width: '96px', height: '96px', borderRadius: '50%' }}
            />
            <div style={{ textAlign: 'center', maxWidth: '480px' }}>
                <Text variant="h3" style={{ color: CssVar.backdropText, overflowWrap: 'anywhere' }}>
                    {username}
                </Text>
                {/* 説明文は CFM だが、ここはアプリのプロバイダ(絵文字・メディアビューア等)を載せないので素の文字で出す */}
                <Text style={{ color: CssVar.backdropText, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {loaded.profile.description}
                </Text>
            </div>

            <GuestClientProvider client={loaded.client}>
                <UrlSummaryProvider>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2),
                            width: '100%',
                            maxWidth: '480px'
                        }}
                    >
                        <Link to={path + '?hint=' + encodeURIComponent(loaded.user.domain)} style={buttonStyle}>
                            <img
                                src="/192.png"
                                alt=""
                                style={{ width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0 }}
                            />
                            <span style={labelStyle}>{loaded.user.alias ?? 'Concrnt'}</span>
                        </Link>
                        {loaded.links.map(({ url }, i) => (
                            <ExternalLink key={i} href={url} style={buttonStyle}>
                                <LinkIcon url={url} size={24} />
                                <span style={labelStyle}>{linkLabel(url)}</span>
                            </ExternalLink>
                        ))}
                    </div>
                </UrlSummaryProvider>
            </GuestClientProvider>
        </div>
    )
}
