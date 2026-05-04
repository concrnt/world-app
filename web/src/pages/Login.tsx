import { Api, DeriveIdentity, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { CssVar, Text } from '@concrnt/ui'
import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { QRSetup } from '../components/QRSetup'
import { AuthActions, AuthBrand, AuthButton, AuthScreen, AuthTextButton, PageHeader } from '../components/AuthLayout'
import { useClient } from '../contexts/Client'
import { string2Uint8Array } from '../util'

const getEntityFromPasskey = async (ccid: string, domain: string) => {
    const authProvider = new InMemoryAuthProvider()
    const kvs = new InMemoryKVS()
    const api = new Api(domain, authProvider, kvs)
    return api.getEntity(ccid)
}

export const Login = () => {
    const { status, error, reload, logout } = useClient()
    const [mode, setMode] = useState<'menu' | 'qr'>('menu')
    const [message, setMessage] = useState<string>('')
    const [processing, setProcessing] = useState(false)

    if (status === 'ready') {
        return <Navigate to="/" replace={true} />
    }

    const loginWithPasskey = async () => {
        setProcessing(true)
        setMessage('')

        try {
            const challenge = new Uint8Array(32)
            crypto.getRandomValues(challenge)

            const credential = await navigator.credentials.get({
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

            if (!credential) {
                throw new Error('パスキーを取得できませんでした。')
            }

            // @ts-expect-error userHandle is available on PublicKeyCredential response
            const userHandle = credential.response?.userHandle
            if (!userHandle) {
                throw new Error('パスキーからユーザー情報を取得できませんでした。')
            }

            let ccid = new TextDecoder().decode(userHandle)
            let domain = 'v2dev.concrnt.net'
            const split = ccid.split('@')
            if (split.length === 2) {
                ccid = split[0]
                domain = split[1]
            }

            const entity = await getEntityFromPasskey(ccid, domain)
            if (!entity) {
                throw new Error('登録済みアカウントが見つかりませんでした。')
            }

            // @ts-expect-error getClientExtensionResults exists on PublicKeyCredential
            const credentialResults = credential.getClientExtensionResults()
            const prfResult = credentialResults?.prf?.results?.first
            if (!prfResult) {
                throw new Error('このブラウザのパスキーでは PRF 拡張が利用できません。')
            }

            const identity = DeriveIdentity(new Uint8Array(prfResult))
            const subkey = `concrnt-subkey ${identity.privateKey} ${ccid}@${entity.value.domain} -`

            localStorage.setItem('Domain', JSON.stringify(entity.value.domain))
            localStorage.setItem('SubKey', JSON.stringify(subkey))
            await reload()
        } catch (caught) {
            console.error(caught)
            setMessage(caught instanceof Error ? caught.message : 'パスキーログインに失敗しました。')
        } finally {
            setProcessing(false)
        }
    }

    if (status === 'loading') {
        return (
            <AuthScreen>
                <PageHeader title="Concrnt" />
                <Text>保存されているセッションを確認しています。</Text>
            </AuthScreen>
        )
    }

    if (status === 'failed') {
        return (
            <AuthScreen>
                <PageHeader title="接続できませんでした" />
                <Text>{error ?? 'クライアントの初期化に失敗しました。'}</Text>
                <AuthActions>
                    <AuthButton
                        onClick={() => {
                            void reload()
                        }}
                    >
                        再試行
                    </AuthButton>
                    <AuthTextButton
                        onClick={() => {
                            void logout()
                        }}
                    >
                        保存済みセッションを破棄する
                    </AuthTextButton>
                </AuthActions>
            </AuthScreen>
        )
    }

    if (mode === 'qr') {
        return (
            <AuthScreen align="top">
                <PageHeader title="Concrnt アプリから受け取る" />
                <div
                    style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        padding: `${CssVar.space(2)} 0`
                    }}
                >
                    <QRSetup />
                </div>
                <AuthActions>
                    <AuthTextButton onClick={() => setMode('menu')}>戻る</AuthTextButton>
                </AuthActions>
            </AuthScreen>
        )
    }

    return (
        <AuthScreen>
            <div style={{ flex: 1 }} />
            <AuthBrand />
            <Text
                style={{
                    textAlign: 'center',
                    lineHeight: 1.7
                }}
            >
                Web クライアントを使い始めるには、パスキーでログインするか、Concrnt アプリからこの端末へアカウントを受け取ってください。
            </Text>
            {message && (
                <Text
                    style={{
                        width: '100%',
                        color: CssVar.uiText
                    }}
                >
                    {message}
                </Text>
            )}
            <div style={{ flex: 1 }} />
            <AuthActions fixedBottom>
                <AuthButton
                    disabled={processing}
                    onClick={() => {
                        void loginWithPasskey()
                    }}
                >
                    {processing ? '確認中...' : 'パスキーでログイン'}
                </AuthButton>
                <AuthButton onClick={() => setMode('qr')}>Concrnt アプリから受け取る</AuthButton>
                <Link
                    to="/register"
                    style={{
                        color: CssVar.uiText,
                        textAlign: 'center'
                    }}
                >
                    新規登録ページを開く
                </Link>
            </AuthActions>
        </AuthScreen>
    )
}
