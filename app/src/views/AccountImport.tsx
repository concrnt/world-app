import { invoke } from '@tauri-apps/api/core'
import { Text, TextField } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'

interface Props {
    onBack?: () => void
    onImported?: () => void
}

export const AccountImport = (props: Props) => {
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
            <AuthHeader
                title="アカウントをインポート"
                description="マスターキーを入力して、この端末でアカウントを使えるようにします。"
            />
            <div style={authStyles.section}>
                <div style={authStyles.inputGroup}>
                    <Text>マスターキー</Text>
                    <TextField
                        value={mnemonic}
                        onChange={(e) => setMnemonic(e.target.value)}
                        placeholder="マスターキーを入力"
                    />
                </div>
                <Text style={authStyles.status}>
                    {mnemonic
                        ? successed
                            ? 'このマスターキーは利用できます。'
                            : 'マスターキーを確認できません。'
                        : ''}
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
                    インポート
                </AuthButton>
                <AuthTextButton onClick={props.onBack}>戻る</AuthTextButton>
            </AuthActions>
        </AuthScreen>
    )
}
