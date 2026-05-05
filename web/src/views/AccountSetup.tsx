import { Text, CssVar } from '@concrnt/ui'
import { useEffect, useRef, useState } from 'react'
import { useResetPreference } from '../contexts/Preference'
import { Api, ComputeCKID, Document, GenerateIdentity, InMemoryAuthProvider, InMemoryKVS, type Identity } from '@concrnt/client'
import { useReloadClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import Tilt from 'react-parallax-tilt'
import { Passport } from '@concrnt/ui'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'

interface Props {
    entrypoint: string
    onBack?: () => void
}

const encodeRegistrationDocument = (input: string) => btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const storeWebSession = (domain: string, masterKey: string, subKey: string) => {
    localStorage.setItem('Domain', domain)
    localStorage.setItem('PrivateKey', masterKey)
    localStorage.setItem('SubKey', subKey)
}

export const AccountSetup = (props: Props) => {
    const reload = useReloadClient()
    const reset = useResetPreference()

    const isConcrntWorld = window.location.hostname === 'concrnt.world' || window.location.hostname === 'localhost'
    const [domain, setDomain] = useState<string>(isConcrntWorld ? props.entrypoint : window.location.hostname)
    const [registrationPageOpened, setRegistrationPageOpened] = useState(false)
    const [accountCreated, setAccountCreated] = useState(false)
    const [finalizing, setFinalizing] = useState(false)
    const [identity, setIdentity] = useState<Identity | null>(null)

    const serverInput = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const timer = setInterval(async () => {
            if (!registrationPageOpened || !identity || accountCreated) return

            const auth = new InMemoryAuthProvider()
            const kvs = new InMemoryKVS()
            const api = new Api(domain, auth, kvs)

            const registration = await api.getEntity(identity.CCID).catch(() => null)
            if (!registration) return

            setAccountCreated(true)
            clearInterval(timer)
        }, 3000)

        return () => {
            clearInterval(timer)
        }
    }, [accountCreated, domain, identity, registrationPageOpened])

    const openRegistrationPage = async (targetDomain: string) => {
        const generated = GenerateIdentity()
        setIdentity(generated)

        const authProvider = new InMemoryAuthProvider(generated.privateKey)
        const document = {
            author: generated.CCID,
            schema: 'https://schema.concrnt.net/entity.json',
            value: {
                domain: targetDomain
            },
            createdAt: new Date().toISOString()
        }

        const docString = JSON.stringify(document)
        const signature = await authProvider.signMaster(docString)
        const encodedDoc = encodeRegistrationDocument(docString)

        window.open(`https://${targetDomain}/register?document=${encodedDoc}&signature=${signature}`, '_blank', 'noopener,noreferrer')
        setRegistrationPageOpened(true)
    }

    const finalize = async () => {
        if (!identity) return

        setFinalizing(true)
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

        await api.commit(subkeyDoc, domain, { useMasterkey: true })

        storeWebSession(domain, identity.privateKey, `concrnt-subkey ${subIdentity.privateKey} ${identity.CCID}@${domain} -`)
        reset()
        await reload()
    }

    const state = accountCreated ? 'done' : 'initial'

    return (
        <AuthScreen align="top">
            {state === 'initial' && (
                <>
                    <AuthHeader
                        title="アカウントを作成"
                        description={isConcrntWorld ? "登録に使うサーバーを選んでから、ブラウザで登録を完了します。" : `${domain} でアカウントを登録します。`}
                    />

                    <div style={authStyles.passportWrap}>
                        <Tilt glareEnable={true} glareBorderRadius="5%">
                            <Passport
                                ccid={identity?.CCID ?? 'con1......................................'}
                                name={'...'}
                                avatar={''}
                                host={domain || 'TBD'}
                                cdate={new Date().toLocaleDateString()}
                            />
                        </Tilt>
                    </div>

                    <div style={authStyles.section}>
                        {isConcrntWorld && (
                            <div style={authStyles.inputGroup}>
                                <Text style={{ color: CssVar.uiText }}>
                                    {props.entrypoint === domain ? 'おすすめサーバー' : 'カスタムサーバー'}
                                </Text>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        width: '100%',
                                        height: 44
                                    }}
                                >
                                    <input
                                        ref={serverInput}
                                        type="text"
                                        value={domain}
                                        onChange={(e) => setDomain(e.target.value)}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            padding: '8px 12px',
                                            borderRadius: `${CssVar.round(1)} 0 0 ${CssVar.round(1)}`,
                                            border: `1px solid ${CssVar.divider}`,
                                            backgroundColor: CssVar.contentBackground,
                                            color: CssVar.contentText,
                                            fontSize: 16
                                        }}
                                    />
                                    <button
                                        type="button"
                                        style={{
                                            padding: '0 14px',
                                            color: CssVar.uiBackground,
                                            border: `1px solid ${CssVar.uiText}`,
                                            borderLeft: 'none',
                                            borderRadius: `0 ${CssVar.round(1)} ${CssVar.round(1)} 0`,
                                            backgroundColor: CssVar.uiText,
                                            fontSize: 14,
                                            fontWeight: 700
                                        }}
                                        onClick={() => {
                                            serverInput.current?.focus()
                                        }}
                                    >
                                        変更
                                    </button>
                                </div>
                            </div>
                        )}

                        <Text style={authStyles.status}>
                            {registrationPageOpened ? 'サーバー上でアカウントが作成されるのを待っています。登録が完了すると自動で次へ進みます。' : ''}
                        </Text>
                    </div>

                    <AuthActions fixedBottom>
                        <AuthButton
                            disabled={!domain || registrationPageOpened}
                            onClick={async () => {
                                await openRegistrationPage(domain)
                            }}
                        >
                            {registrationPageOpened
                                ? '登録待機中...'
                                : isConcrntWorld && props.entrypoint === domain
                                  ? 'おすすめサーバーではじめる'
                                  : 'このサーバーではじめる'}
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>戻る</AuthTextButton>
                    </AuthActions>
                </>
            )}
            {state === 'done' && (
                <>
                    <AuthHeader
                        title="準備完了"
                        description="登録が確認できました。最後にこのブラウザで使う鍵を登録します。"
                    />
                    <AuthActions fixedBottom>
                        <AuthButton disabled={finalizing} onClick={finalize}>
                            {finalizing ? '登録中...' : '完了'}
                        </AuthButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
