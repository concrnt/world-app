import { useEffect, useRef, useState } from 'react'
import { useScanner } from '../contexts/Scanner'
import { Button, View, Text } from '@concrnt/ui'
import { emojihash, semantics, SignalLoginSender } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Document } from '@concrnt/client'
import { Header } from '../ui/Header'

interface Props {
    onComplete?: () => void
}

export const QRSetup = (props: Props) => {
    const { scan } = useScanner()
    const { client } = useClient()

    const [completed, setCompleted] = useState(false)
    const initialized = useRef(false)

    const [pendingCkid, setPendingCkid] = useState<string | null>(null)

    const confirmResolveRef = useRef<((ok: boolean) => void) | null>(null)

    const [sender, setSender] = useState<SignalLoginSender | null>(null)

    const waitUserConfirmation = (ckid: string): Promise<boolean> => {
        setPendingCkid(ckid)

        return new Promise<boolean>((resolve) => {
            confirmResolveRef.current = resolve
        })
    }

    const handleConfirm = () => {
        confirmResolveRef.current?.(true)
        confirmResolveRef.current = null
        setPendingCkid(null)
    }

    const handleCancel = () => {
        confirmResolveRef.current?.(false)
        confirmResolveRef.current = null
        setPendingCkid(null)
    }

    const keyCreationCallback = async (ckid: string): Promise<string> => {
        const ok = await waitUserConfirmation(ckid)

        if (!ok) {
            throw new Error('User cancelled key creation')
        }

        const uri = semantics.subkey(client.ccid, ckid)

        const subkeyDoc: Document<any> = {
            key: uri,
            author: client.ccid,
            schema: 'https://schema.concrnt.net/subkey.json',
            value: {
                ckid
            },
            createdAt: new Date()
        }

        await client.api.commit(subkeyDoc, client.server.domain, { useMasterkey: true })

        return uri
    }

    const scanCallback = (result: string | null) => {
        if (!result) return
        const sender = new SignalLoginSender(result, client.ccid, client.server.domain, keyCreationCallback, () => {
            setCompleted(true)
            props.onComplete?.()
        })
        setSender(sender)
    }

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true
        scan().then(scanCallback)

        return () => {
            sender?.dispose()
            setSender(null)
        }
    }, [scan])

    return (
        <View>
            <Header>他の端末でログイン</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '1rem'
                }}
            >
                {pendingCkid ? (
                    <div>
                        <Text variant="h3">この端末でログインを許可しますか？</Text>
                        <Text>表示されている絵文字が端末で表示されているものと同じであることを確認してください</Text>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                marginTop: '1rem',
                                width: '100%'
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: '2rem'
                                }}
                            >
                                {emojihash(pendingCkid)}
                            </Text>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '1rem',
                                marginTop: '1rem',
                                alignItems: 'center',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Button onClick={handleCancel}>Cancel</Button>

                            <Button onClick={handleConfirm}>OK</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {completed ? (
                            <Text variant="h3">ログインが完了しました！</Text>
                        ) : sender ? (
                            <Text variant="h3">端末から情報が送られてくるのを待っています......</Text>
                        ) : (
                            <Button
                                onClick={() => {
                                    scan().then(scanCallback)
                                }}
                            >
                                QRコードをスキャン
                            </Button>
                        )}
                    </>
                )}
            </div>
        </View>
    )
}
