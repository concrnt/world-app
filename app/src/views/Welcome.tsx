import { invoke } from '@tauri-apps/api/core'
import { CssVar, Text, TextField } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccountSetup } from '../views/AccountSetup'
import { AccountImport } from '../views/AccountImport'
import { Api, InMemoryKVS, Document, Entity, InMemoryAuthProvider, SignedDocument } from '@concrnt/client'
import { Passport } from '@concrnt/ui'
import { ProfileSchema, semantics } from '@concrnt/worldlib'
import { TauriAuthProvider } from '../lib/authProvider'
import { useResetPreference } from '../contexts/Preference'
import { LoadingFull } from '../components/LoadingFull'
import { AuthActions, AuthBrand, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'
import { ResetSessionButton } from '../components/ResetSessionButton'

/*
- 完全に初期状態 <initial>
    -> 新規作成
    -> インポート
- CCIDはあるが、サーバー登録がない/みつからない状態 <missing>
    -> 続きから
        -> 作成したことがある？
            -> 登録サーバーを探す
            -> 新しく登録
- CCIDもあり、登録サーバーもある状態 <ready>
    -> このアカウントで続行
    -> 別のアカウントにする (要注意)
*/

export const resolveEntrypoint = (): string => {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === 'tauri.localhost') {
        return 'ariake.concrnt.net'
    }
    return hostname
}

interface User {
    ccid: string
    entity?: Document<Entity>
    profile?: Document<ProfileSchema>
}

export const WelcomeView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.welcome' })
    const [state, setState] = useState<'initial' | 'welcome' | 'signup' | 'signin' | 'missing' | 'ready' | 'error'>(
        'initial'
    )
    const [loadError, setLoadError] = useState<string | null>(null)
    const [existingCCID, setExistingCCID] = useState<string | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [updater, setUpdater] = useState<number>(0)
    const [continuing, setContinuing] = useState(false)
    const [continueError, setContinueError] = useState<string | null>(null)
    const reset = useResetPreference()
    const [resolver, setResolver] = useState<string>(resolveEntrypoint())

    useEffect(() => {
        const load = async () => {
            // アカウント読み取り(get_active_ccid)の失敗だけをエラー画面に落とす。
            // 失敗を「アカウント無し」とみなしてオンボーディングに落とすと、鍵が端末に残っているのに
            // 新規作成へ誘導してしまうため。後続のサーバー通信の失敗はここに含めない(別途catchする)。
            let ccid: string | null
            try {
                ccid = await invoke<string | null>('get_active_ccid')
            } catch (e) {
                console.error('Failed to load active account', e)
                setExistingCCID(null)
                setUser(null)
                setLoadError(e instanceof Error ? e.message : String(e))
                setState('error')
                return
            }

            if (typeof ccid !== 'string') {
                setExistingCCID(null)
                setUser(null)
                setState('welcome')
                return
            }
            setExistingCCID(ccid)

            const authProvider = new InMemoryAuthProvider()
            const kvs = new InMemoryKVS()

            const api = new Api(resolver, authProvider, kvs)

            const entity = await api.getEntity(ccid).catch(() => undefined)
            const profile = await api.getDocument<ProfileSchema>(semantics.profile(ccid, 'main')).catch(() => undefined)

            setUser({
                ccid,
                entity,
                profile
            })
            setState(entity ? 'ready' : 'missing')
        }
        load().catch((e) => {
            // get_active_ccid成功後の想定外の例外。鍵は読めているので、キーチェーン起因ではない。
            console.error('Unexpected error while preparing account view', e)
        })
    }, [updater, resolver])

    const reload = () => {
        setUpdater((prev) => prev + 1)
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
                            World App
                        </Text>
                    </div>
                    <div style={{ flex: 1 }} />
                    <AuthActions fixedBottom>
                        <AuthButton onClick={() => setState('signup')}>{t('getStarted')}</AuthButton>
                        <AuthTextButton onClick={() => setState('signin')}>{t('login')}</AuthTextButton>
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
                    <AuthHeader title={t('welcomeBackTitle')} description={t('welcomeBackDescriptionDevice')} />
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
                        {continueError && (
                            <Text
                                style={{
                                    color: '#ff5b5b',
                                    textAlign: 'center',
                                    wordBreak: 'break-all',
                                    whiteSpace: 'pre-line'
                                }}
                            >
                                {t('continueFailed')}
                                {'\n'}
                                {continueError}
                            </Text>
                        )}
                        <AuthButton
                            disabled={continuing}
                            onClick={async () => {
                                if (!user || !user.entity) return
                                setContinueError(null)
                                setContinuing(true)
                                try {
                                    const ckid: string = await invoke('create_subkey', { ccid: user.ccid })

                                    const subkeyDoc: Document<any> = {
                                        kind: 'record',
                                        key: semantics.subkey(user.ccid, ckid),
                                        author: user.ccid,
                                        schema: 'https://schema.concrnt.net/subkey.json',
                                        value: {
                                            ckid
                                        },
                                        createdAt: new Date()
                                    }

                                    const authProvider = new TauriAuthProvider(user.ccid)
                                    const kvs = new InMemoryKVS()

                                    const api = new Api(user.entity.value.domain, authProvider, kvs)

                                    await api.commit(subkeyDoc, user.entity.value.domain, { useMasterkey: true })
                                    console.log('Subkey Registered')

                                    // v1 -> v2 移行対応:
                                    // v2へ自動的に移行されたユーザーのエンティティは proof.type が "none" に
                                    // なっており、このままでは利用を続けられない。マスターキーが使えるこの
                                    // タイミングで concrnt-ecrecover-direct で再コミットして正しい proof を付与する。
                                    try {
                                        const self = await api.getResource<SignedDocument>(semantics.user(user.ccid))
                                        if (self.proof?.type === 'none') {
                                            console.log(
                                                'Entity proof type is "none", re-committing entity with master key...'
                                            )
                                            const entityDoc: Document<Entity> = {
                                                kind: 'entity',
                                                author: user.ccid,
                                                schema: 'https://schema.concrnt.net/entity.json',
                                                value: user.entity.value,
                                                createdAt: new Date()
                                            }
                                            await api.commit(entityDoc, user.entity.value.domain, {
                                                useMasterkey: true
                                            })
                                        }
                                    } catch (err) {
                                        console.error('Failed to migrate entity proof type', err)
                                    }

                                    await invoke('set_domain', { domain: user.entity.value.domain, ccid: user.ccid })

                                    reset()
                                    window.location.reload()
                                } catch (err) {
                                    console.error('Failed to continue with account', err)
                                    setContinueError(err instanceof Error ? err.message : String(err))
                                    setContinuing(false)
                                }
                            }}
                        >
                            {continuing ? t('continuing') : t('continueWithAccount')}
                        </AuthButton>
                        <ResetSessionButton
                            ccid={user!.ccid}
                            onDone={async () => {
                                reload()
                            }}
                        >
                            {t('removeAccountFromDevice')}
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
            <AuthHeader title={t('recovery.title')} description={t('recovery.descriptionDevice')} />
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
                    {found ? t('recovery.registrationFound') : t('recovery.registrationNotFound')}
                </Text>
            </div>
            {found ? (
                <AuthActions fixedBottom>
                    <AuthButton onClick={props.reload}>{t('recovery.continue')}</AuthButton>
                </AuthActions>
            ) : (
                <AuthActions fixedBottom>
                    <AuthButton
                        onClick={() => {
                            props.giveup()
                        }}
                    >
                        {t('recovery.registerNew')}
                    </AuthButton>
                    <ResetSessionButton
                        ccid={props.ccid}
                        onDone={() => {
                            props.reload()
                        }}
                    >
                        {t('removeAccountFromDevice')}
                    </ResetSessionButton>
                </AuthActions>
            )}
        </AuthScreen>
    )
}
