import { Text, CssVar } from '@concrnt/ui'
import { useEffect, useRef, useState } from 'react'
import { useResetPreference } from '../contexts/Preference'
import {
    Api,
    ComputeCKID,
    Document,
    GenerateIdentity,
    InMemoryAuthProvider,
    InMemoryKVS,
    type Identity
} from '@concrnt/client'
import { useReloadClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import Tilt from 'react-parallax-tilt'
import { Passport } from '@concrnt/ui'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'
import { MdHourglassEmpty, MdPhoneIphone } from 'react-icons/md'

interface Props {
    entrypoint: string
    onBack?: () => void
}

const encodeRegistrationDocument = (input: string) =>
    btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

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
    const [recoveryDownloaded, setRecoveryDownloaded] = useState(false)
    const [registrationPageOpened, setRegistrationPageOpened] = useState(false)
    const [accountCreated, setAccountCreated] = useState(false)
    const [finalizing, setFinalizing] = useState(false)
    const [finalizeError, setFinalizeError] = useState<string | null>(null)
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

    const startSetup = (targetDomain: string) => {
        const generated = GenerateIdentity()
        setIdentity(generated)
        setDomain(targetDomain)
        setRecoveryDownloaded(false)
    }

    const openRegistrationPage = async (targetDomain: string) => {
        if (!identity) return
        const authProvider = new InMemoryAuthProvider(identity.privateKey)
        const document = {
            kind: 'entity' as const,
            author: identity.CCID,
            schema: 'https://schema.concrnt.net/entity.json',
            value: {
                domain: targetDomain
            },
            createdAt: new Date().toISOString()
        }

        const docString = JSON.stringify(document)
        const signature = await authProvider.signMaster(docString)
        const encodedDoc = encodeRegistrationDocument(docString)

        window.open(
            `https://${targetDomain}/register?document=${encodedDoc}&signature=${signature}`,
            '_blank',
            'noopener,noreferrer'
        )
        setRegistrationPageOpened(true)
    }

    const finalize = async () => {
        if (!identity) return

        setFinalizeError(null)
        setFinalizing(true)
        try {
            const authProvider = new InMemoryAuthProvider(identity.privateKey)
            const kvs = new InMemoryKVS()
            const api = new Api(domain, authProvider, kvs)

            const subIdentity = GenerateIdentity()
            const ckid = ComputeCKID(subIdentity.publicKey)

            const subkeyDoc: Document<{ ckid: string }> = {
                kind: 'record',
                key: semantics.subkey(identity.CCID, ckid),
                author: identity.CCID,
                schema: 'https://schema.concrnt.net/subkey.json',
                value: {
                    ckid
                },
                createdAt: new Date()
            }

            await api.commit(subkeyDoc, domain, { useMasterkey: true })

            storeWebSession(
                domain,
                identity.privateKey,
                `concrnt-subkey ${subIdentity.privateKey} ${identity.CCID}@${domain} -`
            )
            reset()
            await reload()
        } catch (err) {
            console.error('Failed to finalize registration', err)
            setFinalizeError(err instanceof Error ? err.message : String(err))
        } finally {
            setFinalizing(false)
        }
    }

    const state = accountCreated ? 'done' : identity && !registrationPageOpened ? 'backup' : 'initial'

    return (
        <AuthScreen align="top">
            {state === 'initial' && (
                <>
                    <AuthHeader
                        title="アカウントを作成"
                        description={
                            isConcrntWorld
                                ? '登録に使うサーバーを選んでから、ブラウザで登録を完了します。'
                                : `${domain} でアカウントを登録します。`
                        }
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
                            {registrationPageOpened
                                ? 'サーバー上でアカウントが作成されるのを待っています。登録が完了すると自動で次へ進みます。'
                                : ''}
                        </Text>
                    </div>

                    <div
                        style={{
                            width: '100%',
                            border: `1px solid ${CssVar.divider}`,
                            borderRadius: CssVar.round(1),
                            padding: CssVar.space(2.5),
                            backgroundColor: `rgb(from ${CssVar.contentBackground} r g b / 0.86)`,
                            boxShadow: `inset 0 1px 0 rgb(from ${CssVar.contentText} r g b / 0.08)`,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: CssVar.space(2)
                        }}
                    >
                        <div
                            style={{
                                width: 42,
                                height: 42,
                                borderRadius: CssVar.round(1),
                                backgroundColor: `rgb(from ${CssVar.contentLink} r g b / 0.14)`,
                                color: CssVar.contentLink,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: '0 0 auto'
                            }}
                        >
                            <MdPhoneIphone size={24} />
                        </div>
                        <div
                            style={{
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(1)
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: CssVar.space(1.5),
                                    flexWrap: 'wrap'
                                }}
                            >
                                <Text
                                    style={{
                                        color: CssVar.contentText,
                                        fontWeight: 700,
                                        lineHeight: 1.35
                                    }}
                                >
                                    アプリでの作成がおすすめ
                                </Text>
                                <div
                                    style={{
                                        height: 26,
                                        padding: `0 ${CssVar.space(1)}`,
                                        borderRadius: CssVar.round(1),
                                        backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.08)`,
                                        color: CssVar.contentText,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: CssVar.space(0.5),
                                        fontSize: 12,
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <MdHourglassEmpty size={16} />
                                    リンク準備中
                                </div>
                            </div>
                            <Text
                                style={{
                                    color: CssVar.contentText,
                                    opacity: 0.76,
                                    lineHeight: 1.65,
                                    fontSize: '0.92rem'
                                }}
                            >
                                マスターキーの保存や端末移行まで含めると、アプリ版での作成がより扱いやすくなります。現在ストア審査中のため、公開後にリンクを案内します。
                            </Text>
                        </div>
                    </div>

                    <AuthActions fixedBottom>
                        <AuthButton
                            disabled={!domain || registrationPageOpened}
                            onClick={() => {
                                startSetup(domain)
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
            {state === 'backup' && identity && (
                <>
                    <AuthHeader
                        title="マスターキーを保存"
                        description="このマスターキーはアカウント復元に必要です。登録を続ける前にダウンロードして、安全な場所に保管してください。"
                    />
                    <div style={authStyles.section}>
                        <div
                            style={{
                                border: `1px solid ${CssVar.divider}`,
                                borderRadius: CssVar.round(1),
                                padding: CssVar.space(2),
                                backgroundColor: CssVar.contentBackground,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(1.5)
                            }}
                        >
                            <Text
                                variant="caption"
                                style={{
                                    color: CssVar.contentText,
                                    opacity: 0.72
                                }}
                            >
                                CCID
                            </Text>
                            <Text
                                style={{
                                    color: CssVar.contentText,
                                    wordBreak: 'break-all',
                                    lineHeight: 1.6
                                }}
                            >
                                {identity.CCID}
                            </Text>
                            <Text
                                variant="caption"
                                style={{
                                    color: CssVar.contentText,
                                    opacity: 0.72
                                }}
                            >
                                登録サーバー
                            </Text>
                            <Text style={{ color: CssVar.contentText }}>{domain}</Text>
                        </div>
                        <Text style={authStyles.status}>
                            {recoveryDownloaded
                                ? 'ダウンロードを開始しました。保存先を確認してから登録へ進んでください。'
                                : 'このファイルを失うと、別の端末やブラウザでアカウントを復元できなくなる可能性があります。'}
                        </Text>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton
                            onClick={() => {
                                const text = `Concrnt マスターキー
このファイルは Concrnt のアカウントを復元するためのものです。
このファイルを安全な場所に保管してください。

CCID: ${identity.CCID}
マスターキー: ${identity.mnemonic_ja}
登録サーバー: ${domain}

マスターキーを紛失した場合、アカウントを復元できなくなる可能性があります。
この内容を他人に知られると、アカウントが乗っ取られる可能性があります。`

                                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
                                const url = URL.createObjectURL(blob)
                                const anchor = document.createElement('a')
                                anchor.href = url
                                anchor.download = `concrnt-masterkey-${identity.CCID}.txt`
                                anchor.click()
                                URL.revokeObjectURL(url)
                                setRecoveryDownloaded(true)
                            }}
                        >
                            マスターキーをダウンロード
                        </AuthButton>
                        <AuthButton
                            variant="outlined"
                            disabled={!recoveryDownloaded}
                            onClick={async () => {
                                await openRegistrationPage(domain)
                            }}
                        >
                            登録ページを開く
                        </AuthButton>
                        <AuthTextButton
                            onClick={() => {
                                setIdentity(null)
                                setRecoveryDownloaded(false)
                            }}
                        >
                            サーバー選択に戻る
                        </AuthTextButton>
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
                        {finalizeError && (
                            <Text style={{ color: '#ff5b5b', textAlign: 'center', wordBreak: 'break-all' }}>
                                登録に失敗しました。通信環境を確認して、もう一度お試しください。
                                {'\n'}
                                {finalizeError}
                            </Text>
                        )}
                        <AuthButton disabled={finalizing} onClick={finalize}>
                            {finalizing ? '登録中...' : '完了'}
                        </AuthButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
