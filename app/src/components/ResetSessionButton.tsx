import { Button, Text } from '@concrnt/ui'
import { useModal } from '../contexts/Modal'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackupKeyButton } from './BackupKeyButton'
import { removeAccount } from '../lib/accounts'

interface Props {
    ccid: string
    children?: React.ReactNode
    onDone?: () => void
}

export const ResetSessionModalContent = (props: { ccid: string; onDone: () => void; onCancel: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'app.resetSessionButton' })
    const [exported, setExported] = useState(false)
    const [error, setError] = useState<string | null>(null)

    return (
        <>
            <Text variant="h3">{t('title')}</Text>

            <Text variant="caption">{t('backupFirst')}</Text>

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
                <Button onClick={props.onCancel}>{t('cancel')}</Button>
                <Button
                    disabled={!exported}
                    onClick={() => {
                        // 他のアカウントには影響しない。最終確認(OSネイティブのyes/noダイアログ)は
                        // Rust側のremove_accountが表示する。キャンセル時はremoved=falseで何もしない。
                        removeAccount(props.ccid)
                            .then((removed) => {
                                if (removed) props.onDone()
                            })
                            .catch((err) => {
                                console.error('Failed to remove account', err)
                                setError(t('deleteFailed'))
                            })
                    }}
                >
                    {t('delete')}
                </Button>
            </div>
        </>
    )
}

export const ResetSessionButton = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.resetSessionButton' })
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
            {props.children || t('resetSession')}
        </Button>
    )
}
