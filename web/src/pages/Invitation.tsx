import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar, CssVar, Text } from '@concrnt/ui'
import { Client, InvitationSchema, semantics, User } from '@concrnt/worldlib'
import { AuthActions, AuthButton, AuthHeader, AuthScreen } from '../views/authLayout'
import { ExternalLink } from '../components/ExternalLink'
import { LoadingFull } from '../components/LoadingFull'
import { resolveEntrypoint } from '../utils/entrypoint'
import appStoreBadge from '../assets/appstore-badge.svg'
import googlePlayBadge from '../assets/googleplay-badge.png'

interface Loaded {
    comment?: string
    inviter: User
    listTitle?: string
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

    useEffect(() => {
        let client: Client | undefined
        let cancelled = false
        const load = async () => {
            // 招待のリストはヒント無しで引くので、招待者のサーバーにつなぐ
            client = await Client.createAsGuest(hint ?? resolveEntrypoint())
            const document = await client.api.getDocument<InvitationSchema>(semantics.invitation(ccid!, id!), hint)
            const inviter = await User.load(client, document.author, hint)
            const list = await client.getList(document.value.list)
            if (cancelled) return
            setLoaded({ comment: document.value.comment, inviter, listTitle: list?.title })
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

    if (loaded === null) {
        return (
            <AuthScreen>
                <AuthHeader title={t('loadFailed')} />
            </AuthScreen>
        )
    }

    return (
        <AuthScreen>
            <Avatar
                ccid={loaded.inviter.ccid}
                src={loaded.inviter.profile.avatar}
                style={{ width: '96px', height: '96px', borderRadius: '50%' }}
            />
            <AuthHeader
                title={t('title', { username: loaded.inviter.profile.username ?? 'anonymous' })}
                description={loaded.comment}
            />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
                <Text style={{ color: CssVar.uiText, opacity: 0.78 }}>{t('list')}</Text>
                <Text style={{ color: CssVar.uiText }}>{loaded.listTitle}</Text>
            </div>
            <AuthActions>
                <AuthButton
                    onClick={() => {
                        window.location.href = `cckv://${ccid}${hint ? '@' + hint : ''}/concrnt.world/invitations/${id}`
                    }}
                >
                    {t('openApp')}
                </AuthButton>
                <Text style={{ color: CssVar.uiText, opacity: 0.78, textAlign: 'center' }}>{t('getApp')}</Text>
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
                        <ExternalLink
                            key={store.label}
                            href={store.url}
                            style={{ display: 'flex', alignItems: 'center' }}
                        >
                            <img src={store.badge} alt={store.label} style={{ height: 48, width: 'auto' }} />
                        </ExternalLink>
                    ))}
                </div>
            </AuthActions>
        </AuthScreen>
    )
}
