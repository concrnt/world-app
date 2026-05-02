import { useEffect, useRef, useState } from 'react'
import { useScanner } from '../contexts/Scanner'
import { Button, View } from '@concrnt/ui'
import { semantics, SignalLoginSender } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Document } from '@concrnt/client'

export const QRSetup = () => {
    const { scan } = useScanner()
    const { client } = useClient()

    const [_completed, setCompleted] = useState(false)
    const initialized = useRef(false)

    const keyCreationCallback = async (ckid: string): Promise<string> => {
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
        new SignalLoginSender(result, client.ccid, client.server.domain, keyCreationCallback, () => {
            setCompleted(true)
        })
    }

    useEffect(() => {
        if (initialized.current) return
        initialized.current = true
        scan().then(scanCallback)
    }, [scan])

    return (
        <View>
            <Button
                onClick={() => {
                    scan().then(scanCallback)
                }}
            >
                Scan QR Code
            </Button>
        </View>
    )
}
