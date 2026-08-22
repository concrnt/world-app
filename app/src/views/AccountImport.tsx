import { invoke } from '@tauri-apps/api/core'
import { Text } from '@concrnt/ui'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'
import { MNEMONIC_WORD_COUNT, MnemonicInput } from '../components/MnemonicInput'

interface Props {
    onBack?: () => void
    onImported?: () => void
}

export const AccountImport = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.accountImport' })
    const [words, setWords] = useState<string[]>(() => Array(MNEMONIC_WORD_COUNT).fill(''))
    const [successed, setSuccessed] = useState<boolean>(false)

    // 12語すべて埋まったときだけ組み立てる(途中の入力で検証を走らせない)
    const mnemonic = useMemo(() => (words.every((w) => w !== '') ? words.join(' ') : ''), [words])

    useEffect(() => {
        if (!mnemonic) return
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

    // 12語が揃っていない間は古い検証結果を引きずらない
    const valid = successed && mnemonic !== ''

    return (
        <AuthScreen align="top">
            <AuthHeader title={t('title')} description={t('descriptionDevice')} />
            <div style={authStyles.section}>
                <div style={authStyles.inputGroup}>
                    <Text>{t('masterKey')}</Text>
                    <Text style={{ opacity: 0.78, fontSize: '0.9rem', lineHeight: 1.6 }}>{t('masterKeyHint')}</Text>
                    <MnemonicInput words={words} onChange={setWords} />
                </div>
                <Text style={authStyles.status}>
                    {mnemonic ? (valid ? t('masterKeyValid') : t('masterKeyInvalid')) : ''}
                </Text>
            </div>
            <AuthActions fixedBottom>
                <AuthButton
                    disabled={!valid}
                    onClick={() => {
                        if (!valid) return

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
