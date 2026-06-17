import { CssVar, Text, TextField } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { useEffect, useMemo, useState } from 'react'
import { AccountSetup } from '../views/AccountSetup'
import { AccountImport } from '../views/AccountImport'
import { Api, InMemoryAuthProvider, InMemoryKVS, Document, Entity } from '@concrnt/client'
import { Passport } from '@concrnt/ui'
import { ProfileSchema, semantics } from '@concrnt/worldlib'
import { useResetPreference } from '../contexts/Preference'
import { LoadingFull } from '../components/LoadingFull'
import { AuthActions, AuthBrand, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'

const resolveEntrypoint = (): string => {
    const hostname = window.location.hostname
    if (hostname === 'localhost') {
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

    const [state, setState] = useState<'initial' | 'welcome' | 'signup' | 'signin' | 'missing' | 'ready'>(
        existingCCID ? 'initial' : 'welcome'
    )

    useEffect(() => {
        if (!existingCCID) return

        const ccid = existingCCID
        const kvs = new InMemoryKVS()
        const api = new Api(resolver, new InMemoryAuthProvider(), kvs)

        Promise.all([
            api.getEntity(ccid).catch(() => undefined),
            api.getDocument<ProfileSchema>(semantics.profile(ccid, 'main')).catch(() => undefined)
        ]).then(([entity, profile]) => {
            setUser({
                ccid,
                entity,
                profile
            })
            setState(entity && subKey ? 'ready' : 'missing')
        })
    }, [updater, resolver, existingCCID, authProvider])

    const reload = () => {
        setUpdater((prev) => prev + 1)
    }

    switch (state) {
        case 'initial':
            return <LoadingFull />
        case 'signup':
            return <AccountSetup entrypoint={resolver} onBack={() => setState('welcome')} />
        case 'signin':
            return <AccountImport onImported={reload} onBack={() => setState('welcome')} />
        case 'welcome':
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
                            variant="caption"
                            style={{
                                color: CssVar.uiText,
                                opacity: 0.72,
                                textAlign: 'center'
                            }}
                        >
                            World App 開発中α版
                        </Text>
                    </div>
                    <div style={{ flex: 1 }} />
                    <AuthActions fixedBottom>
                        <AuthButton onClick={() => setState('signup')}>はじめる</AuthButton>
                        <AuthTextButton onClick={() => (window.location.href = '/login')}>ログイン</AuthTextButton>
                    </AuthActions>
                </AuthScreen>
            )
        case 'missing':
            return (
                <RecoveryView
                    ccid={existingCCID!}
                    reload={reload}
                    giveup={() => setState('signup')}
                    setDomain={(domain) => {
                        setResolver(domain)
                    }}
                />
            )
        case 'ready':
            return (
                <AuthScreen>
                    <AuthHeader
                        title="おかえりなさい"
                        description="このブラウザに保存されているアカウントを確認しました。"
                    />
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
                            このアカウントで続行
                        </AuthButton>
                        <AuthTextButton
                            danger
                            onClick={() => {
                                localStorage.removeItem('Domain')
                                localStorage.removeItem('PrivateKey')
                                localStorage.removeItem('SubKey')
                                reload()
                            }}
                        >
                            ブラウザのアカウント情報をリセットする
                        </AuthTextButton>
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
    const [found, setFound] = useState<boolean>(false)
    const [domain, setDomain] = useState<string>()

    useEffect(() => {
        if (!domain) return

        const auth = new InMemoryAuthProvider()
        const kvs = new InMemoryKVS()
        const api = new Api(domain, auth, kvs)

        api.getEntity(props.ccid)
            .then((entity) => {
                if (entity) {
                    setFound(true)
                    props.setDomain?.(entity.value.domain)
                } else {
                    setFound(false)
                }
            })
            .catch(() => {
                setFound(false)
            })
    }, [domain])

    return (
        <AuthScreen align="top">
            <AuthHeader
                title="登録サーバーを確認してください"
                description="ブラウザにはアカウント情報がありますが、現在のサーバーでは登録情報が見つかりませんでした。"
            />
            <div style={authStyles.section}>
                <div style={authStyles.inputGroup}>
                    <Text style={{ color: CssVar.uiText }}>サーバーアドレス</Text>
                    <TextField
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="サーバーアドレスを入力"
                    />
                </div>
                <Text style={authStyles.status}>
                    {found ? '登録情報が見つかりました。' : '登録情報が見つかりませんでした。'}
                </Text>
            </div>
            {found ? (
                <AuthActions fixedBottom>
                    <AuthButton onClick={props.reload}>続行</AuthButton>
                </AuthActions>
            ) : (
                <AuthActions fixedBottom>
                    <AuthButton onClick={props.giveup}>新規登録する</AuthButton>
                    <AuthTextButton
                        danger
                        onClick={() => {
                            localStorage.removeItem('Domain')
                            localStorage.removeItem('PrivateKey')
                            localStorage.removeItem('SubKey')
                            props.reload()
                        }}
                    >
                        ブラウザのアカウント情報を削除
                    </AuthTextButton>
                </AuthActions>
            )}
        </AuthScreen>
    )
}
