import { Button, Modal, Text } from '@concrnt/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadIdentity } from '@concrnt/client'
import i18n from '../i18n'

interface Props {
    ccid: string
    children?: React.ReactNode
    onDone?: () => void
}

// ブラウザからアカウント情報(マスターキー含む)を完全削除する唯一の導線。
// app版のResetSessionButtonと同じく、マスターキーを保持している場合はバックアップDLを
// 済ませるまで削除ボタンを押せない。他の場所からlocalStorageの鍵を直接消してはいけない
export const ResetSessionModalContent = (props: { ccid: string; onDone: () => void; onCancel: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'app.resetSessionButton' })

    const storedPrivateKey = localStorage.getItem('PrivateKey')
    const storedMnemonic = localStorage.getItem('Mnemonic')
    let masterIdentity = null
    try {
        masterIdentity = storedMnemonic ? LoadIdentity(storedMnemonic) : null
    } catch {
        masterIdentity = null
    }

    // 鍵を保持していないセッション(サブキーのみ)なら失うものが無いため即削除可能
    const hasKey = storedPrivateKey !== null || storedMnemonic !== null
    const [exported, setExported] = useState(!hasKey)

    const backupMasterKey = () => {
        let text: string
        if (masterIdentity) {
            let domain = localStorage.getItem('Domain')
            if (domain?.startsWith('"')) {
                try {
                    domain = JSON.parse(domain)
                } catch {
                    /* raw文字列のまま使う */
                }
            }
            text = i18n.t('views.accountSetup.masterkeyFileTemplate', {
                ccid: props.ccid,
                mnemonic: masterIdentity.mnemonic_ja,
                domain: domain ?? 'N/A'
            })
        } else if (storedPrivateKey) {
            // ニーモニックを持たない(hex鍵のみの)セッションは生の秘密鍵をそのまま保存する
            text = storedPrivateKey
        } else {
            return
        }

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `concrnt-masterkey-${props.ccid}.txt`
        anchor.click()
        URL.revokeObjectURL(url)
        setExported(true)
    }

    return (
        <>
            <Text variant="h3">{t('title')}</Text>

            <Text variant="caption">{hasKey ? t('backupFirst') : t('noKeyToBackup')}</Text>

            {hasKey && <Button onClick={backupMasterKey}>{i18n.t('views.id.backupMasterKey')}</Button>}

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
                        if (!window.confirm(t('confirmDelete'))) return
                        localStorage.removeItem('Domain')
                        localStorage.removeItem('PrivateKey')
                        localStorage.removeItem('Mnemonic')
                        localStorage.removeItem('SubKey')
                        localStorage.removeItem('SelectedProfile')
                        localStorage.removeItem('V1EntityProofPending')
                        props.onDone()
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
    const [resetModalOpen, setResetModalOpen] = useState(false)

    return (
        <>
            <Button
                variant="text"
                onClick={() => setResetModalOpen(true)}
                style={{
                    width: '100%',
                    minHeight: 44,
                    color: '#ff7676',
                    fontSize: '1rem'
                }}
            >
                {props.children || t('resetSession')}
            </Button>
            <Modal open={resetModalOpen} onClose={() => setResetModalOpen(false)}>
                <ResetSessionModalContent
                    ccid={props.ccid}
                    onDone={() => {
                        setResetModalOpen(false)
                        props.onDone?.()
                    }}
                    onCancel={() => {
                        setResetModalOpen(false)
                    }}
                />
            </Modal>
        </>
    )
}
