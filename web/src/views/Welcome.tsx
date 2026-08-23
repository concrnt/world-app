import { CssVar, Text, TextField } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { Api, InMemoryAuthProvider, InMemoryKVS, Document, Entity, NotFoundError } from '@concrnt/client'
import { Passport } from '@concrnt/ui'
import { ProfileSchema, semantics } from '@concrnt/worldlib'
import { useResetPreference } from '../contexts/Preference'
import { LoadingFull } from '../components/LoadingFull'
import { ResetSessionButton } from '../components/ResetSessionButton'
import { AuthActions, AuthBrand, AuthButton, AuthHeader, AuthScreen, authStyles } from './authLayout'

const resolveEntrypoint = (): string => {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === 'concrnt.world') {
        return 'ariake.concrnt.net'
    }
    return hostname
}

interface User {
    ccid: string
    entity?: Document<Entity>
    profile?: Document<ProfileSchema>
}

const readStoredString = (key: string): string | undefined => {
    const value = localStorage.getItem(key)
    if (!value) return undefined

    try {
        const parsed = JSON.parse(value)
        return typeof parsed === 'string' ? parsed : undefined
    } catch {
        return value
    }
}

export const WelcomeView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.welcome' })
    const [user, setUser] = useState<User | null>(null)
    const [updater, setUpdater] = useState<number>(0)
    const reset = useResetPreference()
    const [resolver, setResolver] = useState<string>(resolveEntrypoint())

    const masterKey = readStoredString('PrivateKey')
    const subKey = readStoredString('SubKey')

    const authProvider = useMemo(() => {
        if (!masterKey && !subKey) return null
        return new InMemoryAuthProvider(masterKey, subKey)
    }, [updater, masterKey, subKey])

    const existingCCID = useMemo(() => {
        return authProvider?.getCCID()
    }, [authProvider])

    const [state, setState] = useState<'initial' | 'missing' | 'ready' | 'error'>('initial')
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => {
        if (!existingCCID) return

        const ccid = existingCCID
        const kvs = new InMemoryKVS()
        const api = new Api(resolver, new InMemoryAuthProvider(), kvs)

        const load = async () => {
            // 「登録なし」と断定するのはサーバーが404を返した時だけ。通信失敗やサーバーエラーを
            // missingにすると、鍵がブラウザに残っているのに新規鍵生成への導線が開いてしまう
            let entity: Document<Entity> | undefined
            try {
                entity = await api.getEntity(ccid)
            } catch (e) {
                if (e instanceof NotFoundError) {
                    entity = undefined
                } else {
                    console.error('Failed to check registration', e)
                    setLoadError(e instanceof Error ? e.message : String(e))
                    setState('error')
                    return
                }
            }
            const profile = await api.getDocument<ProfileSchema>(semantics.profile(ccid, 'main')).catch(() => undefined)

            setUser({
                ccid,
                entity,
                profile
            })
            // ログアウト後はSubKeyが無くマスターキーだけが残る。その場合もreadyに落とし、
            // 続行時にClientProviderのマスターキー単独パスがサブキーを再発行して復帰する
            setState(entity && (subKey || masterKey) ? 'ready' : 'missing')
        }
        load().catch((e) => {
            console.error('Unexpected error while preparing account view', e)
        })
    }, [updater, resolver, existingCCID, authProvider])

    const reload = () => {
        setUpdater((prev) => prev + 1)
    }

    if (!existingCCID) {
        return <Navigate to="/login" replace />
    }

    switch (state) {
        case 'initial':
            return <LoadingFull />
        case 'error':
            return (
                <AuthScreen>
                    <div style={{ flex: 1 }} />
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: CssVar.space(2)
                        }}
                    >
                        <AuthBrand />
                        <Text
                            style={{
                                color: CssVar.uiText,
                                textAlign: 'center',
                                whiteSpace: 'pre-line'
                            }}
                        >
                            {t('loadFailed')}
                        </Text>
                        {loadError && (
                            <Text
                                variant="caption"
                                style={{
                                    color: CssVar.uiText,
                                    opacity: 0.6,
                                    textAlign: 'center',
                                    wordBreak: 'break-all'
                                }}
                            >
                                {loadError}
                            </Text>
                        )}
                        <Text
                            variant="caption"
                            style={{
                                color: CssVar.uiText,
                                opacity: 0.6,
                                textAlign: 'center',
                                wordBreak: 'break-all',
                                whiteSpace: 'pre-line'
                            }}
                        >
                            {t('checkingAccount', { ccid: existingCCID, resolver })}
                        </Text>
                    </div>
                    <div style={{ flex: 1 }} />
                    <AuthActions fixedBottom>
                        <AuthButton
                            onClick={() => {
                                setLoadError(null)
                                setState('initial')
                                reload()
                            }}
                        >
                            {t('retry')}
                        </AuthButton>
                    </AuthActions>
                </AuthScreen>
            )
        case 'missing':
            return (
                <RecoveryView
                    ccid={existingCCID}
                    reload={reload}
                    giveup={() => {
                        window.location.href = '/signup'
                    }}
                    setDomain={(domain) => {
                        setResolver(domain)
                    }}
                />
            )
        case 'ready':
            return (
                <AuthScreen>
                    <AuthHeader title={t('welcomeBackTitle')} description={t('welcomeBackDescriptionBrowser')} />
                    <div style={authStyles.passportWrap}>
                        <Tilt glareEnable={true} glareBorderRadius="5%">
                            <Passport
                                ccid={user!.ccid}
                                name={user!.profile?.value.username ?? 'No Name'}
                                avatar={user!.profile?.value.avatar ?? ''}
                                host={user!.entity?.value.domain ?? 'Unknown'}
                                cdate=""
                            />
                        </Tilt>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton
                            onClick={() => {
                                if (user?.entity?.value.domain) localStorage.setItem('Domain', user.entity.value.domain)
                                reset()
                                window.location.reload()
                            }}
                        >
                            {t('continueWithAccount')}
                        </AuthButton>
                        <ResetSessionButton
                            ccid={user!.ccid}
                            onDone={() => {
                                reload()
                            }}
                        >
                            {t('resetBrowserAccount')}
                        </ResetSessionButton>
                    </AuthActions>
                </AuthScreen>
            )
    }
}

const RecoveryView = (props: {
    reload: () => void
    giveup: () => void
    setDomain?: (domain: string) => void
    ccid: string
}) => {
    const { t } = useTranslation('', { keyPrefix: 'views.welcome' })
    // unknown=未入力(何も表示しない)。「見つからない」と表示・断定するのはサーバーが404を返した時だけで、
    // 通信失敗はerrorとして区別する(誤って新規登録/削除に誘導しないため)
    const [found, setFound] = useState<'unknown' | 'found' | 'notfound' | 'error'>('unknown')
    const [domain, setDomain] = useState<string>()

    // 入力が変わったら判定結果を描画中にリセットする(照会完了までは何も表示しない)
    const [checkedDomain, setCheckedDomain] = useState<string | undefined>(undefined)
    if (domain !== checkedDomain) {
        setCheckedDomain(domain)
        setFound('unknown')
    }

    useEffect(() => {
        if (!domain) return

        // 打鍵ごとに照会が飛ばないようデバウンスする
        const timer = setTimeout(() => {
            const auth = new InMemoryAuthProvider()
            const kvs = new InMemoryKVS()
            const api = new Api(domain, auth, kvs)

            api.getEntity(props.ccid)
                .then((entity) => {
                    if (entity) {
                        setFound('found')
                        props.setDomain?.(entity.value.domain)
                    } else {
                        setFound('notfound')
                    }
                })
                .catch((e) => {
                    setFound(e instanceof NotFoundError ? 'notfound' : 'error')
                })
        }, 500)

        return () => {
            clearTimeout(timer)
        }
    }, [domain])

    return (
        <AuthScreen align="top">
            <AuthHeader title={t('recovery.title')} description={t('recovery.descriptionBrowser')} />
            <div style={authStyles.section}>
                <div style={authStyles.inputGroup}>
                    <Text style={{ color: CssVar.uiText }}>{t('recovery.serverAddress')}</Text>
                    <TextField
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder={t('recovery.serverAddressPlaceholder')}
                    />
                </div>
                <Text style={authStyles.status}>
                    {found === 'found'
                        ? t('recovery.registrationFound')
                        : found === 'notfound'
                          ? t('recovery.registrationNotFound')
                          : found === 'error'
                            ? t('recovery.checkFailed')
                            : ''}
                </Text>
            </div>
            {found === 'found' ? (
                <AuthActions fixedBottom>
                    <AuthButton onClick={props.reload}>{t('recovery.continue')}</AuthButton>
                </AuthActions>
            ) : found === 'error' ? null : (
                <AuthActions fixedBottom>
                    <AuthButton onClick={props.giveup}>{t('recovery.registerNew')}</AuthButton>
                    <ResetSessionButton
                        ccid={props.ccid}
                        onDone={() => {
                            props.reload()
                        }}
                    >
                        {t('recovery.deleteBrowserAccount')}
                    </ResetSessionButton>
                </AuthActions>
            )}
        </AuthScreen>
    )
}
