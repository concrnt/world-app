import { invoke } from '@tauri-apps/api/core'
import { Text, CssVar } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useResetPreference } from '../contexts/Preference'
import { TauriAuthProvider } from '../lib/authProvider'
import { Api, InMemoryKVS, Document, InMemoryAuthProvider } from '@concrnt/client'
import { useReloadClient } from '../contexts/Client'
import { openUrl } from '@tauri-apps/plugin-opener'
import { semantics } from '@concrnt/worldlib'
import Tilt from 'react-parallax-tilt'
import { Passport } from '@concrnt/ui'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'
import { useModal } from '../contexts/Modal'
import { ServerSelector } from '../components/ServerSelector'

interface Props {
    entrypoint: string
    onBack?: () => void
    onComplete?: () => void
}

export const AccountSetup = (props: Props) => {
    const reload = useReloadClient()
    const reset = useResetPreference()

    const modal = useModal()

    const [domain, setDomain] = useState<string>(props.entrypoint)
    // initialize_masterの返り値をstateで保持する。多アカウント環境では
    // 「アクティブなアカウント」を再取得すると別のアカウントを掴む恐れがあるため、
    // このフローで生成したccidだけを一貫して使う。
    const [createdCCID, setCreatedCCID] = useState<string | null>(null)
    const [registrationPageOpened, setRegistrationPageOpened] = useState(false)
    const [accountCreated, setAccountCreated] = useState(false)
    const [finalizing, setFinalizing] = useState(false)
    const [finalizeError, setFinalizeError] = useState<string | null>(null)

    useEffect(() => {
        const timer = setInterval(async () => {
            if (!registrationPageOpened || !createdCCID) return
            if (accountCreated) {
                clearInterval(timer)
                return
            }

            const auth = new InMemoryAuthProvider()
            const kvs = new InMemoryKVS()
            const api = new Api(domain, auth, kvs)

            const registration = await api.getEntity(createdCCID)
            if (!registration) {
                console.log('Registration not found, waiting...')
                return
            }

            console.log('Registration found:', registration)
            setAccountCreated(true)

            clearInterval(timer)
        }, 3000)

        return () => {
            clearInterval(timer)
        }
    }, [registrationPageOpened, domain, accountCreated, createdCCID])

    const openRegistrationPage = async (domain: string) => {
        // 二重実行しても新しいアカウントが増えるだけで既存の鍵には触れないが、
        // 孤児アカウントを作らないよう一度生成したccidを使い回す
        const ccid: string = createdCCID ?? (await invoke('initialize_master'))
        setCreatedCCID(ccid)

        const authProvider = new TauriAuthProvider(ccid)

        const document = {
            kind: 'entity' as const,
            author: ccid,
            schema: 'https://schema.concrnt.net/entity.json',
            value: {
                domain
            },
            createdAt: new Date().toISOString()
        }

        const docString = JSON.stringify(document)
        const signature = await authProvider.signMaster(docString)

        const encodedDoc = btoa(docString).replace('+', '-').replace('/', '_').replace('==', '')

        openUrl(`https://${domain}/register?document=${encodedDoc}&signature=${signature}`, 'inAppBrowser')

        setRegistrationPageOpened(true)
    }

    const state = accountCreated ? 'done' : 'initial'

    return (
        <AuthScreen align="top">
            {state === 'initial' && (
                <>
                    <AuthHeader
                        title="アカウントを作成"
                        description="登録に使うサーバーを選んでから、ブラウザで登録を完了します。"
                    />

                    <div style={authStyles.passportWrap}>
                        <Tilt glareEnable={true} glareBorderRadius="5%">
                            <Passport
                                ccid={'con1......................................'}
                                name={'your name'}
                                avatar={''}
                                host={domain}
                                cdate={new Date().toLocaleDateString()}
                            />
                        </Tilt>
                    </div>

                    <div style={authStyles.section}>
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
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        padding: '8px 12px',
                                        borderRadius: `${CssVar.round(1)} 0 0 ${CssVar.round(1)}`,
                                        border: `1px solid ${CssVar.divider}`,
                                        color: CssVar.uiText,
                                        fontSize: 16
                                    }}
                                >
                                    {domain}
                                </div>
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
                                        modal.open(
                                            <ServerSelector
                                                initialServer={domain}
                                                onSelected={(selected) => {
                                                    setDomain(selected)
                                                    modal.close()
                                                }}
                                                onCancel={() => modal.close()}
                                            />
                                        )
                                    }}
                                >
                                    変更
                                </button>
                            </div>
                        </div>

                        <Text style={authStyles.status}>
                            {registrationPageOpened ? 'サーバー上でアカウントが作成されるのを待っています。' : ''}
                        </Text>
                    </div>

                    <AuthActions fixedBottom>
                        <AuthButton
                            onClick={async () => {
                                openRegistrationPage(domain)
                            }}
                        >
                            {props.entrypoint === domain ? 'おすすめサーバーではじめる' : 'このサーバーではじめる'}
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>戻る</AuthTextButton>
                    </AuthActions>
                </>
            )}
            {state === 'done' && (
                <>
                    <AuthHeader
                        title="準備完了"
                        description="登録が確認できました。最後にこの端末で使う鍵を登録します。"
                    />
                    <AuthActions fixedBottom>
                        {finalizeError && (
                            <Text style={{ color: '#ff5b5b', textAlign: 'center', wordBreak: 'break-all' }}>
                                登録に失敗しました。通信環境を確認して、もう一度お試しください。
                                {'\n'}
                                {finalizeError}
                            </Text>
                        )}
                        <AuthButton
                            disabled={finalizing}
                            onClick={async () => {
                                setFinalizeError(null)
                                setFinalizing(true)
                                const ccid = createdCCID
                                if (typeof ccid !== 'string') {
                                    setFinalizeError('プログラムエラー: CCIDが見つかりません')
                                    setFinalizing(false)
                                    return
                                }

                                try {
                                    const authProvider = new TauriAuthProvider(ccid)
                                    const kvs = new InMemoryKVS()

                                    const api = new Api(domain, authProvider, kvs)

                                    const ckid: string = await invoke('create_subkey', { ccid })

                                    const subkeyDoc: Document<any> = {
                                        kind: 'record',
                                        key: semantics.subkey(ccid, ckid),
                                        author: ccid,
                                        schema: 'https://schema.concrnt.net/subkey.json',
                                        value: {
                                            ckid
                                        },
                                        createdAt: new Date()
                                    }

                                    console.log('Committing subkey document:', subkeyDoc)
                                    await api.commit(subkeyDoc, domain, { useMasterkey: true })
                                    console.log('Subkey document committed')
                                    await invoke('set_domain', { domain, ccid })
                                    console.log('Domain set in backend')

                                    reset()
                                    console.log('Preferences reset')
                                    if (props.onComplete) {
                                        props.onComplete()
                                    } else {
                                        reload()
                                        console.log('Client reloaded')
                                    }
                                } catch (err) {
                                    console.error('Failed to finalize registration', err)
                                    setFinalizeError(err instanceof Error ? err.message : String(err))
                                } finally {
                                    setFinalizing(false)
                                }
                            }}
                        >
                            {finalizing ? '登録中...' : '完了'}
                        </AuthButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
