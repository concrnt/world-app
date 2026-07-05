import { Button, Text } from '@concrnt/ui'
import { invoke } from '@tauri-apps/api/core'
import { useModal } from '../contexts/Modal'
import { useState } from 'react'
import { BackupKeyButton } from './BackupKeyButton'
import { resourceCache } from '../lib/cache'

interface Props {
    children?: React.ReactNode
    onDone?: () => void
}

const ResetSessionModalContent = (props: { onDone: () => void; onCancel: () => void }) => {
    const [exported, setExported] = useState(false)

    return (
        <>
            <Text variant="h3">アカウント情報のリセット</Text>

            <Text variant="caption">リセットする前に、現在保存されているアカウント情報をバックアップしましょう。</Text>

            <BackupKeyButton
                onClick={() => {
                    setExported(true)
                }}
            />

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 16
                }}
            >
                <Button onClick={props.onCancel}>キャンセル</Button>
                <Button
                    disabled={!exported}
                    onClick={() => {
                        resourceCache
                            .clear()
                            .catch(() => {})
                            .then(() => invoke('clear_all'))
                            .then(() => {
                                props.onDone()
                            })
                    }}
                >
                    リセット
                </Button>
            </div>
        </>
    )
}

export const ResetSessionButton = (props: Props) => {
    const modal = useModal()

    const handleClick = () => {
        modal.open(
            <ResetSessionModalContent
                onDone={() => {
                    modal.close()
                    props.onDone?.()
                }}
                onCancel={() => {
                    modal.close()
                }}
            />
        )
    }

    return (
        <Button
            variant="text"
            onClick={handleClick}
            style={{
                width: '100%',
                minHeight: 44,
                color: '#ff7676',
                fontSize: '1rem'
            }}
        >
            {props.children || 'Reset Session'}
        </Button>
    )
}
