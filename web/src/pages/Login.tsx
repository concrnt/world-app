import { CssVar, Text, TextField } from '@concrnt/ui'
import { useMemo, useState } from 'react'
import { QRSetup } from '../components/QRSetup'
import { string2Uint8Array } from '../util'
import {
    Api,
    ComputeCKID,
    DeriveIdentity,
    Document,
    Entity,
    GenerateIdentity,
    InMemoryAuthProvider,
    InMemoryKVS,
    LoadIdentity,
    type Identity
} from '@concrnt/client'
import { semantics } from '@concrnt/worldlib'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from '../views/authLayout'
import { useResetPreference } from '../contexts/Preference'

const entrypoint = 'v2dev.concrnt.net'

type LoginMethod = 'qr' | 'passkey' | 'recovery'

const normalizeRecoveryPhrase = (value: string) => value.trim().normalize('NFKD').toLowerCase().replace(/\s+/g, ' ')

const loadRecoveryIdentity = (value: string): Identity | null => {
    if (!value) return null

    try {
        return LoadIdentity(value)
    } catch {
        return null
    }
}

const storeWebSession = (domain: string, masterKey: string | undefined, subKey: string) => {
    localStorage.setItem('Domain', domain)
    if (masterKey) {
        localStorage.setItem('PrivateKey', masterKey)
    } else {
        localStorage.removeItem('PrivateKey')
    }
    localStorage.setItem('SubKey', subKey)
}

const resolveEntity = async (ccid: string, resolver: string, hint?: string): Promise<Document<Entity> | null> => {
    const authProvider = new InMemoryAuthProvider()
    const kvs = new InMemoryKVS()
    const api = new Api(resolver, authProvider, kvs)

    return api.getEntity(ccid, hint).catch(() => null)
}

const createAndCommitSubkey = async (identity: Identity, domain: string) => {
    const authProvider = new InMemoryAuthProvider(identity.privateKey)
    const kvs = new InMemoryKVS()
    const api = new Api(domain, authProvider, kvs)

    const subIdentity = GenerateIdentity()
    const ckid = ComputeCKID(subIdentity.publicKey)

    const subkeyDoc: Document<any> = {
        key: semantics.subkey(identity.CCID, ckid),
        author: identity.CCID,
        schema: 'https://schema.concrnt.net/subkey.json',
        value: {
            ckid
        },
        createdAt: new Date()
    }

    const committed = await api.commit(subkeyDoc, domain, { useMasterkey: true })
    if (!committed) throw new Error('Subkey commit failed')

    return `concrnt-subkey ${subIdentity.privateKey} ${identity.CCID}@${domain} -`
}

export const Login = () => {
    const reset = useResetPreference()
    const [method, setMethod] = useState<LoginMethod>('qr')
    const [status, setStatus] = useState('')
    const [busy, setBusy] = useState(false)
    const [mnemonic, setMnemonic] = useState('')
    const [manualServer, setManualServer] = useState('')
    const [needsServer, setNeedsServer] = useState(false)
    const [resolvedCCID, setResolvedCCID] = useState<string>()

    const normalizedMnemonic = useMemo(() => normalizeRecoveryPhrase(mnemonic), [mnemonic])
    const recoveryIdentity = useMemo(() => {
        return loadRecoveryIdentity(normalizedMnemonic)
    }, [normalizedMnemonic])

    const continueWithSession = () => {
        reset()
        window.location.href = '/'
    }

    const startPasskeyLogin = async () => {
        if (!window.PublicKeyCredential || !navigator.credentials) {
            setStatus('このブラウザではパスキーを利用できません。')
            return
        }

        setBusy(true)
        setStatus('パスキーを確認しています...')

        try {
            const challenge = new Uint8Array(32)
            crypto.getRandomValues(challenge)
            const cred = await navigator.credentials.get({
                publicKey: {
                    challenge,
                    rpId: window.location.hostname,
                    userVerification: 'required',
                    extensions: {
                        prf: {
                            eval: {
                                first: string2Uint8Array('concrnt-world-passkey')
                            }
                        }
                    }
                }
            })

            if (!cred) throw new Error('パスキーが選択されませんでした。')

            // @ts-expect-error - userHandle is not yet in browser types
            const userHandle = cred.response?.userHandle
            if (!userHandle) throw new Error('このパスキーからアカウントIDを取得できませんでした。')

            let ccid = new TextDecoder().decode(userHandle)
            let resolver = entrypoint
            const split = ccid.split('@')
            if (split.length === 2) {
                ccid = split[0]
                resolver = split[1]
            }

            const entity = await resolveEntity(ccid, resolver, resolver)
            const domain = entity?.value.domain
            if (!domain) throw new Error('このパスキーに対応する登録情報が見つかりませんでした。')

            // @ts-expect-error - getClientExtensionResults is not yet in browser types
            const credentialResults = cred.getClientExtensionResults()
            const prfRes = credentialResults?.prf?.results
            if (!prfRes?.first) throw new Error('このパスキーはログインに必要なPRF拡張を利用できません。')

            const identity = DeriveIdentity(new Uint8Array(prfRes.first))
            const subkeyStr = `concrnt-subkey ${identity.privateKey} ${ccid}@${domain} -`

            storeWebSession(domain, undefined, subkeyStr)
            continueWithSession()
        } catch (error) {
            console.error(error)
            setStatus(error instanceof Error ? error.message : 'パスキーログインに失敗しました。')
        } finally {
            setBusy(false)
        }
    }

    const startRecoveryLogin = async (resolverOverride?: string) => {
        const identity = recoveryIdentity
        if (!identity) {
            setStatus('リカバリーフレーズを確認できません。12語のフレーズを入力してください。')
            return
        }

        const resolver = resolverOverride?.trim() || entrypoint
        const isManualResolver = resolver !== entrypoint

        setBusy(true)
        setResolvedCCID(identity.CCID)
        setStatus(`${resolver} で登録情報を確認しています...`)

        try {
            const entity = await resolveEntity(identity.CCID, resolver, isManualResolver ? resolver : undefined)
            const domain = entity?.value.domain

            if (!domain) {
                if (!isManualResolver) {
                    setNeedsServer(true)
                    setStatus(
                        'おすすめサーバーでは登録情報が見つかりませんでした。登録したサーバーを入力してください。'
                    )
                    return
                }
                throw new Error('指定されたサーバーで登録情報が見つかりませんでした。')
            }

            setStatus('このブラウザで使う鍵を登録しています...')
            const subkeyStr = await createAndCommitSubkey(identity, domain)

            storeWebSession(domain, identity.privateKey, subkeyStr)
            continueWithSession()
        } catch (error) {
            console.error(error)
            setStatus(error instanceof Error ? error.message : 'リカバリーフレーズでのログインに失敗しました。')
        } finally {
            setBusy(false)
        }
    }

    return (
        <AuthScreen align="top">
            <AuthHeader
                title="ログイン"
                description="このブラウザでConcrntを使うためのログイン方法を選択してください。"
            />

            <div style={authStyles.section}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: CssVar.space(2),
                        width: '100%'
                    }}
                >
                    <AuthButton
                        disabled={busy}
                        variant={method === 'qr' ? 'contained' : 'outlined'}
                        onClick={() => setMethod('qr')}
                    >
                        アプリでQRログイン
                    </AuthButton>
                    <AuthButton
                        disabled={busy}
                        variant={method === 'passkey' ? 'contained' : 'outlined'}
                        onClick={() => {
                            setMethod('passkey')
                            setStatus('')
                        }}
                    >
                        パスキーでログイン
                    </AuthButton>
                    <AuthButton
                        disabled={busy}
                        variant={method === 'recovery' ? 'contained' : 'outlined'}
                        onClick={() => {
                            setMethod('recovery')
                            setStatus('')
                        }}
                    >
                        リカバリーフレーズでログイン
                    </AuthButton>
                </div>
            </div>

            {method === 'qr' && (
                <div style={authStyles.section}>
                    <QRSetup />
                </div>
            )}

            {method === 'passkey' && (
                <>
                    <div style={authStyles.section}>
                        <Text style={authStyles.status}>{status}</Text>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton disabled={busy} onClick={startPasskeyLogin}>
                            {busy ? '確認中...' : 'パスキーを使う'}
                        </AuthButton>
                    </AuthActions>
                </>
            )}

            {method === 'recovery' && (
                <>
                    <div style={authStyles.section}>
                        <div style={authStyles.inputGroup}>
                            <Text style={{ color: CssVar.uiText }}>リカバリーフレーズ</Text>
                            <TextField
                                value={mnemonic}
                                onChange={(e) => {
                                    setMnemonic(e.target.value)
                                    setNeedsServer(false)
                                    setResolvedCCID(undefined)
                                    setStatus('')
                                }}
                                placeholder="12語のリカバリーフレーズを入力"
                            />
                        </div>

                        {resolvedCCID && <Text style={authStyles.ccid}>{resolvedCCID}</Text>}

                        {needsServer && (
                            <div style={authStyles.inputGroup}>
                                <Text style={{ color: CssVar.uiText }}>登録サーバー</Text>
                                <TextField
                                    value={manualServer}
                                    onChange={(e) => setManualServer(e.target.value)}
                                    placeholder="例: v2dev.concrnt.net"
                                />
                            </div>
                        )}

                        <Text style={authStyles.status}>
                            {status || (mnemonic && !recoveryIdentity ? 'フレーズを確認できません。' : '')}
                        </Text>
                    </div>

                    <AuthActions fixedBottom>
                        {needsServer ? (
                            <AuthButton
                                disabled={busy || !manualServer.trim()}
                                onClick={() => startRecoveryLogin(manualServer)}
                            >
                                {busy ? '確認中...' : 'このサーバーでログイン'}
                            </AuthButton>
                        ) : (
                            <AuthButton disabled={busy || !recoveryIdentity} onClick={() => startRecoveryLogin()}>
                                {busy ? '確認中...' : 'リカバリーフレーズでログイン'}
                            </AuthButton>
                        )}
                        <AuthTextButton
                            onClick={() => {
                                setMnemonic('')
                                setManualServer('')
                                setNeedsServer(false)
                                setResolvedCCID(undefined)
                                setStatus('')
                            }}
                        >
                            入力をクリア
                        </AuthTextButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
