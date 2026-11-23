import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar, Button, CssVar, Modal, Text } from '@concrnt/ui'
import { QRCode } from 'react-qrcode-logo'
import { Client, InvitationSchema, semantics, User } from '@concrnt/worldlib'
import { BackgroundPost, PostsBackground, scatterPosition } from '../components/welcome/PostsBackground'
import { ExternalLink } from '../components/ExternalLink'
import { LoadingFull } from '../components/LoadingFull'
import { resolveEntrypoint } from '../utils/entrypoint'
import appStoreBadge from '../assets/appstore-badge.svg'
import googlePlayBadge from '../assets/googleplay-badge.png'

interface Loaded {
    comment: string
    inviter: User
}

// 招待リンク(https://concrnt.world/invitation/:ccid/:id?hint=)の受け皿。
// 招待の受け取りはアプリだけなので、ここでは招待状を見せて cckv:// でアプリへ渡す
export const InvitationPage = () => {
    const { t } = useTranslation('', { keyPrefix: 'web.invitation' })
    const { ccid, id } = useParams()
    const [searchParams] = useSearchParams()
    const hint = searchParams.get('hint') ?? undefined
    // undefined: ロード中 / null: 取得失敗
    const [loaded, setLoaded] = useState<Loaded | null>()
    const [qrOpen, setQrOpen] = useState(false)
    const [recentPosts, setRecentPosts] = useState<BackgroundPost[]>([])

    useEffect(() => {
        let client: Client | undefined
        let cancelled = false
        const load = async () => {
            const guest = await Client.createAsGuest(hint ?? resolveEntrypoint())
            client = guest
            const document = await guest.api.getDocument<InvitationSchema>(semantics.invitation(ccid!, id!), hint)
            const inviter = await User.load(guest, document.author, hint)
            if (cancelled) return
            setLoaded({ comment: document.value.comment, inviter })
            return { guest, timelines: document.value.timelines }
        }
        // 招待状を出した後で、招待のタイムラインの最近の投稿を背景に少しずつ混ぜる。
        // どんな場所に招待されたかの雰囲気を伝える飾りなので、失敗しても招待状はそのまま見せる
        const addRecentPosts = async ({ guest, timelines }: { guest: Client; timelines: string[] }) => {
            const items = await guest.api.getTimelineRecent(timelines)
            for (const item of items.slice(0, 16)) {
                await new Promise((resolve) => setTimeout(resolve, 1500))
                if (cancelled) return
                // 消された投稿や本文の無い投稿(リルート等)は飛ばす
                const document = await guest.api.getDocument<{ body?: string }>(item.href!).catch(() => null)
                if (!document?.value.body) continue
                const author = await User.load(guest, document.author).catch(() => null)
                if (cancelled) return
                const post: BackgroundPost = {
                    key: item.href!,
                    ccid: document.author,
                    username: author?.profile.username ?? 'anonymous',
                    avatarURL: author?.profile.avatar,
                    body: document.value.body,
                    position: scatterPosition(Math.random())
                }
                setRecentPosts((prev) => [...prev, post])
            }
        }
        load()
            .then(
                (result) => result && addRecentPosts(result),
                (err) => {
                    console.error('Failed to load invitation', err)
                    if (!cancelled) setLoaded(null)
                }
            )
            .catch((err) => console.error('Failed to load recent posts', err))
        return () => {
            cancelled = true
            client?.dispose()
        }
    }, [ccid, id, hint])

    if (loaded === undefined) return <LoadingFull />

    const titleStyle = { fontSize: '2rem', lineHeight: 1.2, textAlign: 'center' } as const

    const storeBadges = (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: CssVar.space(2),
                flexWrap: 'wrap'
            }}
        >
            {[
                {
                    label: 'Download on the App Store',
                    badge: appStoreBadge,
                    url: 'https://apps.apple.com/jp/app/concrnt-world/id6757524249'
                },
                {
                    label: 'Get it on Google Play',
                    badge: googlePlayBadge,
                    url: 'https://play.google.com/store/apps/details?id=world.concrnt.app'
                }
            ].map((store) => (
                <ExternalLink key={store.label} href={store.url} style={{ display: 'flex', alignItems: 'center' }}>
                    <img src={store.badge} alt={store.label} style={{ height: 48, width: 'auto' }} />
                </ExternalLink>
            ))}
        </div>
    )

    return (
        <div
            style={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: CssVar.contentBackground
            }}
        >
            <PostsBackground scatter posts={recentPosts} />
            {/* 小さい画面ではカードが画面より高くなるので、中央寄せの枠ごと伸びてページがスクロールするようにする。
                zIndex は使わず、position を付けて先にある fixed の背景より DOM 順で前面に出す */}
            <div
                style={{
                    flex: 1,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: CssVar.space(4),
                    boxSizing: 'border-box',
                    position: 'relative'
                }}
            >
                <div
                    style={{
                        width: '100%',
                        maxWidth: 440,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: CssVar.space(5),
                        padding: `${CssVar.space(8)} ${CssVar.space(5)}`,
                        boxSizing: 'border-box',
                        borderRadius: CssVar.round(2),
                        color: CssVar.contentText,
                        // 背景の投稿が透けて見えるよう半透明にし、文字が読めるようぼかす
                        backgroundColor: `rgb(from ${CssVar.contentBackground} r g b / 0.7)`,
                        backdropFilter: 'blur(8px)',
                        boxShadow:
                            '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)'
                    }}
                >
                    {loaded === null ? (
                        <Text variant="h1" style={titleStyle}>
                            {t('loadFailed')}
                        </Text>
                    ) : (
                        <>
                            <Text variant="h1" style={titleStyle}>
                                {t('title', { username: loaded.inviter.profile.username ?? 'anonymous' })}
                            </Text>
                            {/* v1 と同じく、招待者のアバターに「<」で吹き出しを付けてメッセージを添える */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: CssVar.space(2),
                                    margin: `${CssVar.space(4)} 0`
                                }}
                            >
                                <Avatar
                                    ccid={loaded.inviter.ccid}
                                    src={loaded.inviter.profile.avatar}
                                    style={{ width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0 }}
                                />
                                <Text style={{ fontSize: '1.5rem', wordBreak: 'break-word' }}>
                                    &lt;&nbsp;{loaded.comment}
                                </Text>
                            </div>
                            <div
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: CssVar.space(3)
                                }}
                            >
                                <Button
                                    style={{ width: '100%', minHeight: 48, fontSize: '1rem', fontWeight: 700 }}
                                    onClick={() => {
                                        // この端末にアプリがあればそのまま開く。PC で見ている人はモーダルの QR でスマホに渡す
                                        window.location.href = `cckv://${ccid}${hint ? '@' + hint : ''}/concrnt.world/invitations/${id}`
                                        setQrOpen(true)
                                    }}
                                >
                                    {t('openApp')}
                                </Button>
                                {storeBadges}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Modal
                open={qrOpen}
                onClose={() => setQrOpen(false)}
                // 既定の top: 30% だと大きい QR で下にはみ出すので、中央に置いて収まらなければスクロールさせる
                style={{ width: 'min(480px, 92vw)', top: 'auto', maxHeight: '92dvh', overflowY: 'auto' }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: CssVar.space(3),
                        padding: CssVar.space(4)
                    }}
                >
                    <Text variant="h2">{t('qrTitle')}</Text>
                    <Text style={{ textAlign: 'center' }}>{t('qrDescription')}</Text>
                    {/* カメラで読めばアプリの有無に関わらずこの招待ページが開くよう、cckv:// ではなく招待リンクを入れる */}
                    <QRCode
                        value={`https://concrnt.world/invitation/${ccid}/${id}${hint ? '?hint=' + hint : ''}`}
                        size={500}
                        ecLevel="L"
                        quietZone={30}
                        fgColor="#000000"
                        bgColor="#ffffff"
                        style={{ width: '100%', maxWidth: 'min(360px, 45dvh)', height: 'auto', display: 'block' }}
                    />
                    <Text style={{ textAlign: 'center' }}>{t('qrGetApp')}</Text>
                    {storeBadges}
                    <Button variant="text" onClick={() => setQrOpen(false)}>
                        {t('close')}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
