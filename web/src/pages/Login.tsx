import { CssVar, Text, TextField, ToggleGroup } from '@concrnt/ui'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { QRSetup } from '../components/QRSetup'
import { string2Uint8Array } from '../util'
import {
    Api,
    ComputeCCID,
    ComputeCKID,
    DeriveIdentity,
    Document,
    Entity,
    GenerateIdentity,
    InMemoryAuthProvider,
    InMemoryKVS,
    IsValid256k1PrivateKey,
    LoadIdentity,
    LoadKey,
    LoadSubKey,
    NotFoundError,
    SignedDocument,
    type Identity,
    type SubKey
} from '@concrnt/client'
import { semantics } from '@concrnt/worldlib'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from '../views/authLayout'
import { useResetPreference } from '../contexts/Preference'

const resolveEntrypoint = (): string => {
    const hostname = window.location.hostname
    if (hostname === 'localhost') {
        return 'ariake.concrnt.net'
    }
    return hostname
}

type LoginMethod = 'qr' | 'passkey' | 'recovery'

const normalizeRecoveryPhrase = (value: string) => value.trim().normalize('NFKD').toLowerCase().replace(/\s+/g, ' ')

const loadRecoveryIdentity = (value: string): Identity | null => {
    if (!value) return null

    // 旧webバックアップファイルやv1環境からの復元用に、64桁hexの生秘密鍵も受け付ける
    const hexMatch = value.match(/^(?:0x)?([0-9a-f]{64})$/)
    if (hexMatch) {
        // ellipticのkeyFromPrivateは曲線オーダー外の鍵も黙って受けるため先に弾く
        if (!IsValid256k1PrivateKey(hexMatch[1])) return null
        const keypair = LoadKey(hexMatch[1])
        if (!keypair) return null
        return {
            mnemonic: '',
            mnemonic_ja: '',
            privateKey: keypair.privatekey,
            publicKey: keypair.publickey,
            CCID: ComputeCCID(keypair.publickey)
        }
    }

    try {
        return LoadIdentity(value)
    } catch {
        return null
    }
}

const storeWebSession = (
    domain: string,
    masterKey: string | undefined,
    mnemonic: string | undefined,
    subKey: string
) => {
    localStorage.setItem('Domain', domain)
    if (masterKey) {
        localStorage.setItem('PrivateKey', masterKey)
    } else {
        localStorage.removeItem('PrivateKey')
    }
    if (mnemonic) {
        localStorage.setItem('Mnemonic', mnemonic)
    } else {
        // 前セッションの別アカウントのニーモニックが残るとID画面で誤ったマスターキーをDLさせてしまう
        localStorage.removeItem('Mnemonic')
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
        kind: 'record',
        key: semantics.subkey(identity.CCID, ckid),
        author: identity.CCID,
        schema: 'https://schema.concrnt.net/subkey.json',
        value: {
            ckid
        },
        createdAt: new Date(),
        onUpdate: 'retain'
    }

    const committed = await api.commit(subkeyDoc, domain, { useMasterkey: true })
    if (!committed) throw new Error(i18n.t('web.login.subkeyCommitFailed'))

    return `concrnt-subkey ${subIdentity.privateKey} ${identity.CCID}@${domain} -`
}

// v1 -> v2 移行対応:
// v2へ自動的に移行されたユーザーのエンティティは proof.type が "none" になっており、
// このままでは利用を続けられない。マスターキーでログインしたこのタイミングで、
// エンティティを concrnt-ecrecover-direct で再コミットして正しい proof を付与する。
const ensureEntityProof = async (identity: Identity, domain: string) => {
    const authProvider = new InMemoryAuthProvider(identity.privateKey)
    const kvs = new InMemoryKVS()
    const api = new Api(domain, authProvider, kvs)

    const self = await api.getResource<SignedDocument>(semantics.user(identity.CCID))
    if (self.proof?.type !== 'none') return

    console.log('Entity proof type is "none", re-committing entity with master key...')
    const entityDoc: Document<Entity> = {
        kind: 'entity',
        author: identity.CCID,
        schema: 'https://schema.concrnt.net/entity.json',
        value: JSON.parse(self.document).value,
        createdAt: new Date()
    }
    await api.commit(entityDoc, domain, { useMasterkey: true })
}

export const Login = () => {
    const { t } = useTranslation('', { keyPrefix: 'web.login' })
    const navigate = useNavigate()
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

    // normalizeRecoveryPhraseはNFKD+小文字化するため、サブキー文字列は正規化前の生入力で判定する
    const parsedSubkey = useMemo((): { str: string; key: SubKey } | null => {
        const trimmed = mnemonic.trim()
        if (!trimmed.startsWith('concrnt-subkey')) return null
        const key = LoadSubKey(trimmed)
        return key ? { str: trimmed, key } : null
    }, [mnemonic])

    const continueWithSession = () => {
        reset()
        window.location.href = '/'
    }

    const entrypoint = useMemo(() => resolveEntrypoint(), [])

    const startPasskeyLogin = async () => {
        if (!window.PublicKeyCredential || !navigator.credentials) {
            setStatus(t('passkeyUnavailable'))
            return
        }

        setBusy(true)
        setStatus(t('checkingPasskey'))

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

            if (!cred) throw new Error(t('passkeyNotSelected'))

            // @ts-expect-error - userHandle is not yet in browser types
            const userHandle = cred.response?.userHandle
            if (!userHandle) throw new Error(t('passkeyNoUserHandle'))

            let ccid = new TextDecoder().decode(userHandle)
            let resolver = entrypoint
            const split = ccid.split('@')
            if (split.length === 2) {
                ccid = split[0]
                resolver = split[1]
            }

            const entity = await resolveEntity(ccid, resolver, resolver)
            const domain = entity?.value.domain
            if (!domain) throw new Error(t('passkeyNoRegistration'))

            // @ts-expect-error - getClientExtensionResults is not yet in browser types
            const credentialResults = cred.getClientExtensionResults()
            const prfRes = credentialResults?.prf?.results
            if (!prfRes?.first) throw new Error(t('passkeyNoPrf'))

            const identity = DeriveIdentity(new Uint8Array(prfRes.first))
            const subkeyStr = `concrnt-subkey ${identity.privateKey} ${ccid}@${domain} -`

            storeWebSession(domain, undefined, undefined, subkeyStr)
            continueWithSession()
        } catch (error) {
            console.error(error)
            setStatus(error instanceof Error ? error.message : t('passkeyLoginFailed'))
        } finally {
            setBusy(false)
        }
    }

    const startSubkeyLogin = async (subkeyStr: string, subkey: SubKey) => {
        setBusy(true)
        setResolvedCCID(subkey.ccid)
        setStatus(t('checkingSubkey', { domain: subkey.domain }))

        try {
            const authProvider = new InMemoryAuthProvider(undefined, subkeyStr)
            const kvs = new InMemoryKVS()
            const api = new Api(subkey.domain, authProvider, kvs)

            let valid = false
            try {
                const doc = await api.getDocument(semantics.subkey(subkey.ccid, subkey.ckid), undefined, {
                    cache: 'no-cache'
                })
                // revoked-subkey.jsonによる同一キー上書き(CIP-13)はrevoke扱い
                valid = doc.kind === 'record' && doc.schema === 'https://schema.concrnt.net/subkey.json'
            } catch (err) {
                if (!(err instanceof NotFoundError)) throw err
            }
            if (!valid) {
                setStatus(t('subkeyInvalidOnServer'))
                return
            }

            storeWebSession(subkey.domain, undefined, undefined, subkeyStr)
            continueWithSession()
        } catch (error) {
            console.error(error)
            setStatus(error instanceof Error ? error.message : t('subkeyLoginFailed'))
        } finally {
            setBusy(false)
        }
    }

    const startRecoveryLogin = async (resolverOverride?: string) => {
        const identity = recoveryIdentity
        if (!identity) {
            setStatus(t('masterKeyInvalidDetailed'))
            return
        }

        const resolver = resolverOverride?.trim() || entrypoint
        const isManualResolver = resolver !== entrypoint

        setBusy(true)
        setResolvedCCID(identity.CCID)
        setStatus(t('checkingRegistration', { resolver }))

        try {
            const entity = await resolveEntity(identity.CCID, resolver, isManualResolver ? resolver : undefined)
            const domain = entity?.value.domain

            if (!domain) {
                if (!isManualResolver) {
                    setNeedsServer(true)
                    setStatus(t('registrationNotFoundOnRecommended'))
                    return
                }
                throw new Error(t('registrationNotFoundOnServer'))
            }

            setStatus(t('registeringKey'))
            const subkeyStr = await createAndCommitSubkey(identity, domain)

            await ensureEntityProof(identity, domain).catch((err) => {
                console.error('Failed to migrate entity proof type', err)
            })

            storeWebSession(domain, identity.privateKey, identity.mnemonic, subkeyStr)
            continueWithSession()
        } catch (error) {
            console.error(error)
            setStatus(error instanceof Error ? error.message : t('masterKeyLoginFailed'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <AuthScreen align="top">
            <AuthHeader title={t('title')} description={t('description')} />

            <div style={authStyles.section}>
                <ToggleGroup
                    options={[
                        { value: 'qr', label: t('methodQr') },
                        { value: 'passkey', label: t('methodPasskey') },
                        { value: 'recovery', label: t('methodManual') }
                    ]}
                    value={method}
                    onChange={(value: LoginMethod) => {
                        setMethod(value)
                        setStatus('')
                    }}
                    disabled={busy}
                />
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
                            {busy ? t('checking') : t('usePasskey')}
                        </AuthButton>
                    </AuthActions>
                </>
            )}

            {method === 'recovery' && (
                <>
                    <div style={authStyles.section}>
                        <div style={authStyles.inputGroup}>
                            <Text style={{ color: CssVar.uiText }}>{t('manualKey')}</Text>
                            <TextField
                                value={mnemonic}
                                onChange={(e) => {
                                    setMnemonic(e.target.value)
                                    setNeedsServer(false)
                                    setResolvedCCID(undefined)
                                    setStatus('')
                                }}
                                placeholder={t('manualKeyPlaceholder')}
                            />
                        </div>

                        {resolvedCCID && <Text style={authStyles.ccid}>{resolvedCCID}</Text>}

                        {needsServer && (
                            <div style={authStyles.inputGroup}>
                                <Text style={{ color: CssVar.uiText }}>{t('registeredServer')}</Text>
                                <TextField
                                    value={manualServer}
                                    onChange={(e) => setManualServer(e.target.value)}
                                    placeholder={t('serverPlaceholder')}
                                />
                            </div>
                        )}

                        <Text style={authStyles.status}>
                            {status ||
                                (mnemonic && !recoveryIdentity && !parsedSubkey
                                    ? mnemonic.trim().startsWith('concrnt-subkey')
                                        ? t('subkeyInvalid')
                                        : t('masterKeyInvalid')
                                    : '')}
                        </Text>
                    </div>

                    <AuthActions fixedBottom>
                        {needsServer ? (
                            <AuthButton
                                disabled={busy || !manualServer.trim()}
                                onClick={() => startRecoveryLogin(manualServer)}
                            >
                                {busy ? t('checking') : t('loginWithThisServer')}
                            </AuthButton>
                        ) : (
                            <AuthButton
                                disabled={busy || (!recoveryIdentity && !parsedSubkey)}
                                onClick={() => {
                                    if (parsedSubkey) {
                                        startSubkeyLogin(parsedSubkey.str, parsedSubkey.key)
                                    } else {
                                        startRecoveryLogin()
                                    }
                                }}
                            >
                                {busy ? t('checking') : parsedSubkey ? t('subkeyLogin') : t('masterKeyLogin')}
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
                            {t('clearInput')}
                        </AuthTextButton>
                    </AuthActions>
                </>
            )}

            <AuthActions>
                <AuthTextButton onClick={() => navigate('/signup')}>{t('signup')}</AuthTextButton>
            </AuthActions>
        </AuthScreen>
    )
}
