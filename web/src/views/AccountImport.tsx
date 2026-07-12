import { Text, TextField } from '@concrnt/ui'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadIdentity } from '@concrnt/client'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'

interface Props {
    onBack?: () => void
    onImported?: () => void
}

export const AccountImport = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.accountImport' })
    const [mnemonic, setMnemonic] = useState<string>('')
    const [update, setUpdate] = useState<number>(0)

    const existingMaster = localStorage.getItem('PrivateKey')
    const identity = useMemo(() => LoadIdentity(mnemonic), [mnemonic])

    useEffect(() => {}, [update])

    return (
        <AuthScreen align="top">
            {existingMaster ? (
                <>
                    <AuthHeader title={t('existingAccountTitle')} description={t('existingAccountDescription')} />
                    <div style={authStyles.section}>
                        <Text style={authStyles.ccid}>{t('existingMasterKeyNotice')}</Text>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton
                            variant="outlined"
                            danger
                            onClick={() => {
                                localStorage.removeItem('Domain')
                                localStorage.removeItem('PrivateKey')
                                localStorage.removeItem('SubKey')
                                setUpdate((v) => v + 1)
                            }}
                        >
                            {t('deleteBrowserAccount')}
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>{t('back')}</AuthTextButton>
                    </AuthActions>
                </>
            ) : (
                <>
                    <AuthHeader title={t('title')} description={t('descriptionBrowser')} />
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
                            {mnemonic ? (identity ? t('masterKeyValid') : t('masterKeyInvalid')) : ''}
                        </Text>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton
                            disabled={!identity}
                            onClick={() => {
                                if (!identity) return
                                localStorage.setItem('PrivateKey', identity.privateKey)
                                props.onImported?.()
                            }}
                        >
                            {t('import')}
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>{t('back')}</AuthTextButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
