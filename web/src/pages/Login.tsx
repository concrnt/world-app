import { CssVar, Text, TextField, ToggleGroup } from '@concrnt/ui'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
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
    SignedDocument,
    type Identity
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
        kind: 'record',
        key: semantics.subkey(identity.CCID, ckid),
        author: identity.CCID,
        schema: 'https://schema.concrnt.net/subkey.json',
        value: {
            ckid
        },
        createdAt: new Date()
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

            storeWebSession(domain, undefined, subkeyStr)
            continueWithSession()
        } catch (error) {
            console.error(error)
            setStatus(error instanceof Error ? error.message : t('passkeyLoginFailed'))
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

            storeWebSession(domain, identity.privateKey, subkeyStr)
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
                        { value: 'recovery', label: t('methodMasterKey') }
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
                            <Text style={{ color: CssVar.uiText }}>{t('masterKey')}</Text>
                            <TextField
                                value={mnemonic}
                                onChange={(e) => {
                                    setMnemonic(e.target.value)
                                    setNeedsServer(false)
                                    setResolvedCCID(undefined)
                                    setStatus('')
                                }}
                                placeholder={t('masterKeyPlaceholder')}
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
                            {status || (mnemonic && !recoveryIdentity ? t('masterKeyInvalid') : '')}
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
                            <AuthButton disabled={busy || !recoveryIdentity} onClick={() => startRecoveryLogin()}>
                                {busy ? t('checking') : t('masterKeyLogin')}
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
