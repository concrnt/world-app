import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar, Button, CssVar, Modal, Text } from '@concrnt/ui'
import { QRCode } from 'react-qrcode-logo'
import { Client, InvitationSchema, semantics, User } from '@concrnt/worldlib'
import { AuthActions, AuthButton, AuthHeader } from '../views/authLayout'
import { PostsBackground } from '../components/welcome/PostsBackground'
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
        }
        load().catch((err) => {
            console.error('Failed to load invitation', err)
            if (!cancelled) setLoaded(null)
        })
        return () => {
            cancelled = true
            client?.dispose()
        }
    }, [ccid, id, hint])

    if (loaded === undefined) return <LoadingFull />

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
            <PostsBackground />
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
                        color: CssVar.uiText,
                        backgroundColor: CssVar.uiBackground,
                        boxShadow:
                            '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)'
                    }}
                >
                    {loaded === null ? (
                        <AuthHeader title={t('loadFailed')} />
                    ) : (
                        <>
                            <AuthHeader
                                title={t('title', { username: loaded.inviter.profile.username ?? 'anonymous' })}
                            />
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
                                <Text style={{ color: CssVar.uiText, fontSize: '1.5rem', wordBreak: 'break-word' }}>
                                    &lt;&nbsp;{loaded.comment}
                                </Text>
                            </div>
                            <AuthActions>
                                <AuthButton
                                    onClick={() => {
                                        // この端末にアプリがあればそのまま開く。PC で見ている人はモーダルの QR でスマホに渡す
                                        window.location.href = `cckv://${ccid}${hint ? '@' + hint : ''}/concrnt.world/invitations/${id}`
                                        setQrOpen(true)
                                    }}
                                >
                                    {t('openApp')}
                                </AuthButton>
                                {storeBadges}
                            </AuthActions>
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
