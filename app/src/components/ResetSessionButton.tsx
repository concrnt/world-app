import { Button, Text } from '@concrnt/ui'
import { useModal } from '../contexts/Modal'
import { useState } from 'react'
import { BackupKeyButton } from './BackupKeyButton'
import { removeAccount } from '../lib/accounts'

interface Props {
    ccid: string
    children?: React.ReactNode
    onDone?: () => void
}

export const ResetSessionModalContent = (props: { ccid: string; onDone: () => void; onCancel: () => void }) => {
    const [exported, setExported] = useState(false)
    const [error, setError] = useState<string | null>(null)

    return (
        <>
            <Text variant="h3">アカウント情報の削除</Text>

            <Text variant="caption">削除する前に、このアカウントのマスターキーをバックアップしましょう。</Text>

            <BackupKeyButton
                ccid={props.ccid}
                onClick={() => {
                    setExported(true)
                }}
            />

            {error && <Text variant="caption">{error}</Text>}

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
                        // 他のアカウントには影響しない。生体認証はRust側で要求される
                        removeAccount(props.ccid)
                            .then(() => {
                                props.onDone()
                            })
                            .catch((err) => {
                                console.error('Failed to remove account', err)
                                setError('削除できませんでした。認証をキャンセルした場合はやり直してください。')
                            })
                    }}
                >
                    削除
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
                ccid={props.ccid}
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
