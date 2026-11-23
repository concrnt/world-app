import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, CssVar, Text } from '@concrnt/ui'
import { Client, InvitationSchema, User } from '@concrnt/worldlib'
import { LoadingFull } from '../components/LoadingFull'
import { applyInvitation, StoredInvitation } from '../utils/invitation'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton } from './authLayout'

interface Props {
    // 未ログイン(Welcome)ではゲストクライアントを渡す
    client: Client
    uri: string
    hint?: string
    onBack: () => void
}

interface Loaded {
    invitation: StoredInvitation
    inviter: User
}

export const InvitationView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.invitation' })
    // undefined: ロード中 / null: 取得失敗
    const [loaded, setLoaded] = useState<Loaded | null>()
    const [accepting, setAccepting] = useState(false)
    const [acceptError, setAcceptError] = useState<string | null>(null)
    const isGuest = props.client.ccid === ''

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            const document = await props.client.api.getDocument<InvitationSchema>(props.uri, props.hint)
            const inviter = await User.load(props.client, document.author, props.hint)
            if (cancelled) return
            setLoaded({
                invitation: { domain: inviter.domain, inviter: document.author, value: document.value },
                inviter
            })
        }
        load().catch((err) => {
            console.error('Failed to load invitation', err)
            if (!cancelled) setLoaded(null)
        })
        return () => {
            cancelled = true
        }
    }, [props.client, props.uri, props.hint])

    if (loaded === undefined) return <LoadingFull />

    if (loaded === null) {
        return (
            <AuthScreen>
                <AuthHeader title={t('loadFailed')} />
                <AuthActions fixedBottom>
                    <AuthTextButton onClick={props.onBack}>{t('back')}</AuthTextButton>
                </AuthActions>
            </AuthScreen>
        )
    }

    return (
        <AuthScreen align="top">
            <AuthHeader title={t('title', { username: loaded.inviter.profile.username ?? 'anonymous' })} />
            {/* v1 と同じく、招待者のアバターに「<」で吹き出しを付けてメッセージを添える */}
            <div
                style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(2), margin: `${CssVar.space(4)} 0` }}
            >
                <Avatar
                    ccid={loaded.inviter.ccid}
                    src={loaded.inviter.profile.avatar}
                    style={{ width: '64px', height: '64px', flexShrink: 0 }}
                />
                <Text style={{ color: CssVar.uiText, fontSize: '1.5rem', wordBreak: 'break-word' }}>
                    &lt;&nbsp;{loaded.invitation.value.comment}
                </Text>
            </div>
            <AuthActions fixedBottom>
                {acceptError && (
                    <Text style={{ color: '#ff5b5b', textAlign: 'center', wordBreak: 'break-all' }}>{acceptError}</Text>
                )}
                <AuthButton
                    disabled={accepting}
                    onClick={async () => {
                        setAcceptError(null)
                        setAccepting(true)
                        try {
                            if (isGuest) {
                                // セッションが無い状態で起動し直すと、ClientProviderが保存した招待でゲストとして立ち上げる
                                localStorage.setItem('invitation', JSON.stringify(loaded.invitation))
                                window.location.reload()
                            } else {
                                await applyInvitation(
                                    props.client,
                                    loaded.invitation,
                                    t('tabName', { username: loaded.inviter.profile.username ?? 'anonymous' })
                                )
                                props.onBack()
                            }
                        } catch (err) {
                            console.error('Failed to accept invitation', err)
                            setAcceptError(err instanceof Error ? err.message : String(err))
                        } finally {
                            setAccepting(false)
                        }
                    }}
                >
                    {isGuest ? t('acceptAsGuest') : t('addToHome')}
                </AuthButton>
                <AuthTextButton onClick={props.onBack}>{t('back')}</AuthTextButton>
            </AuthActions>
        </AuthScreen>
    )
}
