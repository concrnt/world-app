import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar } from '@concrnt/ui'
import { AccountSetup } from '../views/AccountSetup'
import { AccountImport } from '../views/AccountImport'
import { resolveEntrypoint } from '../views/Welcome'
import { AuthButton, AuthHeader, AuthTextButton } from '../views/authLayout'
import { switchAccount } from '../lib/accounts'

interface Props {
    // 開いた時点のアクティブアカウント。initialize_master/initialize_from_mnemonicは
    // 即座に新アカウントをアクティブ化するため、キャンセル時はここへ戻す
    previousCcid: string
    onClose: () => void
}

export const AddAccountDrawer = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.addAccountDrawer' })
    const [mode, setMode] = useState<'menu' | 'create' | 'import'>('menu')

    // 追加が完了したら新アカウント(既にアクティブ)で起動し直す。
    // localStorageの設定類は前のアカウントのものなので持ち越さない
    const finish = () => {
        localStorage.clear()
        window.location.reload()
    }

    // キャンセル: アクティブポインタを元のアカウントへ戻して閉じる。
    // 作成途中のアカウントは一覧に「セットアップ未完了」として残り、
    // 選択すればWelcomeの復帰フローからセットアップを再開できる
    const cancel = async () => {
        await switchAccount(props.previousCcid).catch(() => {})
        props.onClose()
    }

    if (mode === 'create') {
        return <AccountSetup entrypoint={resolveEntrypoint()} onBack={cancel} onComplete={finish} />
    }

    if (mode === 'import') {
        return <AccountImport onBack={cancel} onImported={finish} />
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(3),
                padding: `${CssVar.space(4)} ${CssVar.space(3)} calc(env(safe-area-inset-bottom) + ${CssVar.space(4)})`
            }}
        >
            <AuthHeader title={t('title')} description={t('description')} />
            <AuthButton onClick={() => setMode('create')}>{t('createNew')}</AuthButton>
            <AuthButton variant="outlined" onClick={() => setMode('import')}>
                {t('importExisting')}
            </AuthButton>
            <AuthTextButton onClick={() => props.onClose()}>{t('cancel')}</AuthTextButton>
        </div>
    )
}
