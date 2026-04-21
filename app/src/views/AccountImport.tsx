import { invoke } from '@tauri-apps/api/core'
import { Text, Button, TextField } from '@concrnt/ui'
import { useEffect, useState } from 'react'

interface Props {
    onBack?: () => void
    onImported?: () => void
}

export const AccountImport = (props: Props) => {
    const [mnemonic, setMnemonic] = useState<string>('')
    const [successed, setSuccessed] = useState<boolean>(false)

    const [existingCCID, setExistingCCID] = useState<string | null>(null)

    const [update, setUpdate] = useState<number>(0)

    useEffect(() => {
        invoke('has_masterkey')
            .then((existing) => {
                if (typeof existing !== 'string') return
                setExistingCCID(existing)
            })
            .catch((_e) => {
                setExistingCCID(null)
            })
    }, [update])

    useEffect(() => {
        invoke('load_identity', { mnemonic })
            .then((result) => {
                console.log('Identity loaded', result)
                setSuccessed(true)
            })
            .catch((err) => {
                console.error('Failed to load identity', err)
                setSuccessed(false)
            })
    }, [mnemonic])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                height: '100dvh'
            }}
        >
            {existingCCID ? (
                <div
                    style={{
                        flex: 1
                    }}
                >
                    <Text>端末にはすでにアカウントが保存されています</Text>
                    <Text>CCID: {existingCCID}</Text>

                    <Text>
                        新しくアカウントをインポートするには、端末に保存されたアカウントを削除する必要があります
                    </Text>

                    <Button
                        style={{
                            backgroundColor: 'transparent',
                            color: 'red',
                            border: '1px solid red'
                        }}
                        onClick={async () => {
                            await invoke('clear_all').then(async () => {
                                setUpdate((v) => v + 1)
                            })
                        }}
                    >
                        リセットする
                    </Button>
                </div>
            ) : (
                <div
                    style={{
                        flex: 1
                    }}
                >
                    <Text>mnemonic</Text>
                    <TextField value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} />
                    {successed ? 'OK' : 'NG'}
                    <Button
                        disabled={!successed}
                        onClick={() => {
                            if (!successed) return

                            invoke('initialize_from_mnemonic', { mnemonic })
                                .then(() => {
                                    console.log('Identity initialized from mnemonic')
                                    props.onImported?.()
                                })
                                .catch((err) => {
                                    console.error('Failed to initialize identity from mnemonic', err)
                                })
                        }}
                    >
                        Import
                    </Button>
                </div>
            )}
            <Button onClick={props.onBack}>Back</Button>
        </div>
    )
}
