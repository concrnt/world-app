// 他の端末のログイン (signal) の送信側。QR / deep link で受け取ったチャンネルに接続し、
// 相手の端末から要求されたサブキーの作成をユーザーに確認してから master key で登録する。
// 相手の画面と同じ絵文字 (CKID の emojihash) を見比べさせる
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '@concrnt/ui'
import { emojihash, semantics, SignalLoginSender } from '@concrnt/worldlib'
import type { Document } from '@concrnt/client'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'

interface Props {
    channelUrl: string // wss://<host>/<path>
    onComplete: () => void
}

export const SignalLoginConsent = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.qrSetup' })
    const { client } = useClient()

    const [completed, setCompleted] = useState(false)
    const [pendingCkid, setPendingCkid] = useState<string | null>(null)
    const [pendingName, setPendingName] = useState<string | undefined>(undefined)
    const confirmResolveRef = useRef<((ok: boolean) => void) | null>(null)
    // 読んだのが web の「このサーバーに登録する」QR だったとき(この端末には既にアカウントがある)
    const [pendingRegisterDomain, setPendingRegisterDomain] = useState<string | null>(null)
    const registerResolveRef = useRef<((ok: boolean) => void) | null>(null)

    const host = new URL(props.channelUrl).host

    const waitUserConfirmation = (ckid: string, name?: string): Promise<boolean> => {
        setPendingCkid(ckid)
        setPendingName(name)
        return new Promise<boolean>((resolve) => {
            confirmResolveRef.current = resolve
        })
    }

    const answer = (ok: boolean) => {
        confirmResolveRef.current?.(ok)
        confirmResolveRef.current = null
        setPendingCkid(null)
    }

    const answerRegister = (ok: boolean) => {
        registerResolveRef.current?.(ok)
        registerResolveRef.current = null
        setPendingRegisterDomain(null)
        if (!ok) props.onComplete()
    }

    useEffect(() => {
        // name は受信側(web の新規追加モーダル)が付けた表示名。worldlib 側で検証済み(空/長すぎは undefined)
        const keyCreationCallback = async (ckid: string, name?: string): Promise<string> => {
            const ok = await waitUserConfirmation(ckid, name)
            if (!ok) {
                throw new Error('User cancelled key creation')
            }

            const uri = semantics.subkey(client.ccid, ckid)
            const subkeyDoc: Document<any> = {
                kind: 'record',
                key: uri,
                author: client.ccid,
                schema: 'https://schema.concrnt.net/subkey.json',
                value: name ? { ckid, name } : { ckid },
                createdAt: new Date(),
                onUpdate: 'retain'
            }
            await client.api.commit(subkeyDoc, client.server.domain, { useMasterkey: true })
            return uri
        }

        const sender = new SignalLoginSender(
            props.channelUrl,
            client.ccid,
            client.server.domain,
            keyCreationCallback,
            () => {
                setCompleted(true)
                props.onComplete()
            },
            {
                // 登録 QR: 既存アカウントで web をログインさせるかを一度だけ確認する。OK なら通常のログイン手順に合流
                onRegisterRequest: (domain: string) => {
                    setPendingRegisterDomain(domain)
                    return new Promise<boolean>((resolve) => {
                        registerResolveRef.current = resolve
                    })
                }
            }
        )
        return () => {
            sender.dispose()
        }
        // channelUrl が変わったときだけ張り直す
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.channelUrl])

    if (completed) {
        return <Text variant="h3">{t('loginCompleted')}</Text>
    }

    if (pendingRegisterDomain) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1.5) }}>
                <Text variant="h4" style={{ margin: 0 }}>
                    {t('alreadyHaveAccountTitle')}
                </Text>
                <Text style={{ margin: 0 }}>
                    {t('alreadyHaveAccountDescription', {
                        username: client.profile.username || client.ccid,
                        accountDomain: client.server.domain,
                        domain: pendingRegisterDomain
                    })}
                </Text>
                <Text variant="caption" style={{ margin: 0, fontWeight: 'bold', color: 'inherit' }}>
                    {t('linkWarning')}
                </Text>
                <div style={{ display: 'flex', gap: CssVar.space(1), justifyContent: 'flex-end' }}>
                    <Button variant="outlined" onClick={() => answerRegister(false)}>
                        {t('alreadyHaveAccountNo')}
                    </Button>
                    <Button onClick={() => answerRegister(true)}>{t('alreadyHaveAccountYes')}</Button>
                </div>
            </div>
        )
    }

    if (pendingCkid) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1.5) }}>
                <Text variant="h4" style={{ margin: 0 }}>
                    {t('confirmTitle')}
                </Text>
                <Text style={{ margin: 0 }}>{t('confirmDescription')}</Text>
                <Text style={{ margin: 0, fontSize: '2rem', lineHeight: 1.2, textAlign: 'center' }}>
                    {emojihash(pendingCkid)}
                </Text>
                {pendingName && (
                    <Text style={{ margin: 0, textAlign: 'center' }}>{t('keyName', { name: pendingName })}</Text>
                )}
                {/* リンクで届いた要求を踏まされている可能性 (CIP-17 §10.1 と同じ形) に備えて、別端末へのログインであることを明示する */}
                <Text variant="caption" style={{ margin: 0, fontWeight: 'bold', color: 'inherit' }}>
                    {t('linkWarning')}
                </Text>
                <div style={{ display: 'flex', gap: CssVar.space(1), justifyContent: 'flex-end' }}>
                    <Button variant="outlined" onClick={() => answer(false)}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={() => answer(true)}>{t('ok')}</Button>
                </div>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
            <Text variant="h4" style={{ margin: 0 }}>
                {t('waitingForDevice')}
            </Text>
            <Text variant="caption" style={{ margin: 0, wordBreak: 'break-all' }}>
                {t('signalHost', { host })}
            </Text>
        </div>
    )
}
