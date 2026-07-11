import { invoke } from '@tauri-apps/api/core'
import { Text, TextField } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'

interface Props {
    onBack?: () => void
    onImported?: () => void
}

export const AccountImport = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.accountImport' })
    const [mnemonic, setMnemonic] = useState<string>('')
    const [successed, setSuccessed] = useState<boolean>(false)

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
        <AuthScreen align="top">
            <AuthHeader title={t('title')} description={t('descriptionDevice')} />
            <div style={authStyles.section}>
                <div style={authStyles.inputGroup}>
                    <Text>{t('masterKey')}</Text>
                    <TextField
                        value={mnemonic}
                        onChange={(e) => setMnemonic(e.target.value)}
                        placeholder={t('masterKeyPlaceholder')}
                    />
                </div>
                <Text style={authStyles.status}>
                    {mnemonic ? (successed ? t('masterKeyValid') : t('masterKeyInvalid')) : ''}
                </Text>
            </div>
            <AuthActions fixedBottom>
                <AuthButton
                    disabled={!successed}
                    onClick={() => {
                        if (!successed) return

                        // 既にインポート済みのアカウントの場合は既存のsubkey等を維持したまま
                        // アクティブ化されるだけ(冪等)なので、事前チェックは不要
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
                    {t('import')}
                </AuthButton>
                <AuthTextButton onClick={props.onBack}>{t('back')}</AuthTextButton>
            </AuthActions>
        </AuthScreen>
    )
}
