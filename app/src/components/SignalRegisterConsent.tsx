// アカウントの無いこの端末で、web の「このサーバーに登録する」QR (signal) を読んだときの画面。
// web から登録先 domain が届く → 同意 → マスターキーを作って entity 文書に署名して web へ → web が登録 →
// web が自分用に作ったサブキーを (SignalLoginConsent と同じ絵文字確認のうえ) マスターキーで enact →
// 続けてこの端末自身のセットアップ (AccountSetup の完了処理と同じ) を行いログイン済みにする
import { invoke } from '@tauri-apps/api/core'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '@concrnt/ui'
import { Api, type Document, InMemoryKVS } from '@concrnt/client'
import { Client, emojihash, semantics, type SignalRegisterInitResponse, SignalRegisterSender } from '@concrnt/worldlib'
import { TauriAuthProvider } from '../lib/authProvider'
import { getResourceCache } from '../lib/cache'
import { setupDefaultTimelines } from '../utils/clientSetup'
import { useReloadClient } from '../contexts/Client'
import { useResetPreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from '../views/authLayout'

interface Props {
    channelUrl: string // wss://<host>/<path>
    // 同じセッションで既に生成したマスターキー。QR を読み直しても新しい鍵を増やさないために引き継ぐ
    ccid?: string | null
    onCcidCreated: (ccid: string) => void
    onCancel: () => void
}

type State =
    | 'waiting'
    | 'consent'
    | 'sent'
    | 'confirmKey'
    | 'committing'
    | 'finalizing'
    | 'done'
    | 'loginRequested'
    | 'error'

export const SignalRegisterConsent = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.qrRegister' })
    const reload = useReloadClient()
    const reset = useResetPreference()

    const [state, setState] = useState<State>('waiting')
    const [domain, setDomain] = useState<string>('')
    const [ccid, setCcid] = useState<string | null>(props.ccid ?? null)
    const [pendingCkid, setPendingCkid] = useState<string | null>(null)
    const [pendingName, setPendingName] = useState<string | undefined>(undefined)
    const [error, setError] = useState<string | null>(null)
    const consentResolveRef = useRef<((ok: boolean) => void) | null>(null)
    const keyResolveRef = useRef<((ok: boolean) => void) | null>(null)
    // sender の effect は channelUrl でしか張り直さないので、最新の値を ref から読む
    const ccidRef = useRef<string | null>(props.ccid ?? null)
    const domainRef = useRef<string>('')
    const onCcidCreatedRef = useRef(props.onCcidCreated)
    onCcidCreatedRef.current = props.onCcidCreated
    const onCancelRef = useRef(props.onCancel)
    onCancelRef.current = props.onCancel

    const host = new URL(props.channelUrl).host

    const finalize = async (ccid: string, domain: string) => {
        setError(null)
        setState('finalizing')
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
                createdAt: new Date(),
                onUpdate: 'retain'
            }

            await api.commit(subkeyDoc, domain, { useMasterkey: true })
            await invoke('set_domain', { domain, ccid })

            // 起動がネットワークを待たないよう、自分のwell-known/entityをリソースキャッシュへ保存し
            // (Client.createのネットワーク経路が書く)、ホーム/通知/アクティビティタイムラインも
            // ここで作っておく(起動後はこれらの存在を前提に描画し、検証は裏で行う)
            const client = await Client.create(domain, new TauriAuthProvider(ccid, ckid), getResourceCache(ccid))
            await setupDefaultTimelines(client)
            client.dispose()

            reset()
            setState('done')
            reload()
        } catch (err) {
            console.error('Failed to finalize registration', err)
            setError(err instanceof Error ? err.message : String(err))
            setState('error')
        }
    }

    useEffect(() => {
        const onRegisterRequest = async (domain: string): Promise<SignalRegisterInitResponse | null> => {
            domainRef.current = domain
            setDomain(domain)
            setState('consent')
            const ok = await new Promise<boolean>((resolve) => {
                consentResolveRef.current = resolve
            })
            consentResolveRef.current = null
            if (!ok) {
                onCancelRef.current()
                return null
            }

            // 鍵は同意してから作る(同意前にキャンセルしても端末に何も残らない)
            const ccid: string = ccidRef.current ?? (await invoke('initialize_master'))
            ccidRef.current = ccid
            setCcid(ccid)
            onCcidCreatedRef.current(ccid)

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

            setState('sent')
            return {
                type: 'signal_register_init_response',
                ccid,
                domain,
                entity: {
                    document: docString,
                    proof: { type: 'concrnt-ecrecover-direct', signature }
                }
            }
        }

        // web が登録を終えて自分用に作ったサブキー。SignalLoginConsent と同じ確認のうえマスターキーで enact する。
        // entity が未登録ならサーバーが拒否するので、成功した時点で登録済みが確定する
        const keyCreationCallback = async (ckid: string, name?: string): Promise<string> => {
            const ccid = ccidRef.current
            const domain = domainRef.current
            if (!ccid || !domain) throw new Error('master key is not created yet')

            setPendingCkid(ckid)
            setPendingName(name)
            setState('confirmKey')
            const ok = await new Promise<boolean>((resolve) => {
                keyResolveRef.current = resolve
            })
            keyResolveRef.current = null
            setPendingCkid(null)
            if (!ok) {
                setState('sent')
                throw new Error('User cancelled key creation')
            }

            setState('committing')
            const api = new Api(domain, new TauriAuthProvider(ccid), new InMemoryKVS())
            const uri = semantics.subkey(ccid, ckid)
            const subkeyDoc: Document<any> = {
                kind: 'record',
                key: uri,
                author: ccid,
                schema: 'https://schema.concrnt.net/subkey.json',
                value: name ? { ckid, name } : { ckid },
                createdAt: new Date(),
                onUpdate: 'retain'
            }
            await api.commit(subkeyDoc, domain, { useMasterkey: true })

            // web への応答を先に返し、この端末のセットアップは続けて行う
            setTimeout(() => {
                void finalize(ccid, domain)
            }, 0)
            return uri
        }

        const sender = new SignalRegisterSender(props.channelUrl, {
            onRegisterRequest,
            keyCreationCallback,
            onLoginRequest: () => {
                setState((prev) => (prev === 'waiting' ? 'loginRequested' : prev))
            },
            onCompleted: () => {}
        })
        return () => {
            sender.dispose()
        }
        // channelUrl が変わったときだけ張り直す
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.channelUrl])

    const answerConsent = (ok: boolean) => {
        consentResolveRef.current?.(ok)
    }

    const answerKey = (ok: boolean) => {
        keyResolveRef.current?.(ok)
    }

    switch (state) {
        case 'consent':
            return (
                <AuthScreen align="top">
                    <AuthHeader title={t('consentTitle', { domain })} description={t('consentDescription')} />
                    <Text style={{ color: CssVar.uiText, fontWeight: 'bold', margin: 0 }}>{t('linkWarning')}</Text>
                    <AuthActions fixedBottom>
                        <AuthButton onClick={() => answerConsent(true)}>{t('ok')}</AuthButton>
                        <AuthTextButton onClick={() => answerConsent(false)}>{t('cancel')}</AuthTextButton>
                    </AuthActions>
                </AuthScreen>
            )
        case 'sent':
            return (
                <AuthScreen align="top">
                    <AuthHeader title={t('sentTitle')} description={t('sentDescription', { domain })} />
                    {ccid && (
                        <div
                            style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: CssVar.space(2),
                                textAlign: 'center'
                            }}
                        >
                            <Text style={{ fontSize: '2rem', margin: 0 }}>{emojihash(ccid)}</Text>
                            <Text style={{ color: CssVar.uiText, margin: 0 }}>{t('compareEmoji')}</Text>
                            <Text variant="caption" style={authStyles.ccid}>
                                {ccid}
                            </Text>
                        </div>
                    )}
                    <AuthActions fixedBottom>
                        <Text variant="caption" style={{ color: CssVar.uiText, opacity: 0.72, textAlign: 'center' }}>
                            {t('cancelWithKeyWarning')}
                        </Text>
                        <AuthTextButton onClick={props.onCancel}>{t('cancel')}</AuthTextButton>
                    </AuthActions>
                </AuthScreen>
            )
        case 'confirmKey':
            return (
                <AuthScreen align="top">
                    <AuthHeader title={t('confirmTitle')} description={t('confirmDescription')} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1.5), width: '100%' }}>
                        <Text style={{ margin: 0, fontSize: '2rem', lineHeight: 1.2, textAlign: 'center' }}>
                            {pendingCkid ? emojihash(pendingCkid) : ''}
                        </Text>
                        {pendingName && (
                            <Text style={{ margin: 0, textAlign: 'center', color: CssVar.uiText }}>
                                {t('keyName', { name: pendingName })}
                            </Text>
                        )}
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton onClick={() => answerKey(true)}>{t('allow')}</AuthButton>
                        <AuthTextButton onClick={() => answerKey(false)}>{t('cancel')}</AuthTextButton>
                    </AuthActions>
                </AuthScreen>
            )
        case 'committing':
        case 'finalizing':
            return (
                <AuthScreen>
                    <AuthHeader title={t('finalizing')} />
                </AuthScreen>
            )
        case 'done':
            return (
                <AuthScreen>
                    <AuthHeader title={t('done')} />
                </AuthScreen>
            )
        case 'error':
            return (
                <AuthScreen align="top">
                    <AuthHeader title={t('finalizeFailed')} />
                    <Text
                        style={{
                            color: '#ff5b5b',
                            textAlign: 'center',
                            wordBreak: 'break-all',
                            whiteSpace: 'pre-line'
                        }}
                    >
                        {error}
                    </Text>
                    <AuthActions fixedBottom>
                        <AuthButton
                            onClick={() => {
                                if (ccid) void finalize(ccid, domain)
                            }}
                        >
                            {t('retry')}
                        </AuthButton>
                    </AuthActions>
                </AuthScreen>
            )
        case 'loginRequested':
            return (
                <AuthScreen align="top">
                    <AuthHeader title={t('loginRequestedTitle')} description={t('loginRequestedDescription')} />
                    <AuthActions fixedBottom>
                        <AuthButton onClick={props.onCancel}>{t('back')}</AuthButton>
                    </AuthActions>
                </AuthScreen>
            )
        case 'waiting':
        default:
            return (
                <AuthScreen align="top">
                    <AuthHeader title={t('title')} description={t('waiting')} />
                    <Text variant="caption" style={{ color: CssVar.uiText, opacity: 0.72, wordBreak: 'break-all' }}>
                        {t('signalHost', { host })}
                    </Text>
                    <AuthActions fixedBottom>
                        <Button variant="text" style={{ color: CssVar.uiText }} onClick={props.onCancel}>
                            {t('cancel')}
                        </Button>
                    </AuthActions>
                </AuthScreen>
            )
    }
}
