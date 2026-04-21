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
        <AuthScreen align="top">
            {existingCCID ? (
                <>
                    <AuthHeader
                        title="保存済みアカウントがあります"
                        description="新しくインポートするには、端末に保存されたアカウント情報を先に削除する必要があります。"
                    />
                    <div style={authStyles.section}>
                        <Text style={authStyles.ccid}>CCID: {existingCCID}</Text>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton
                            variant="outlined"
                            danger
                            onClick={async () => {
                                await invoke('clear_all').then(async () => {
                                    setUpdate((v) => v + 1)
                                })
                            }}
                        >
                            端末のアカウント情報を削除
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>戻る</AuthTextButton>
                    </AuthActions>
                </>
            ) : (
                <>
                    <AuthHeader
                        title="アカウントをインポート"
                        description="リカバリーフレーズを入力して、この端末でアカウントを使えるようにします。"
                    />
                    <div style={authStyles.section}>
                        <div style={authStyles.inputGroup}>
                            <Text>リカバリーフレーズ</Text>
                            <TextField
                                value={mnemonic}
                                onChange={(e) => setMnemonic(e.target.value)}
                                placeholder="リカバリーフレーズを入力"
                            />
                        </div>
                        <Text style={authStyles.status}>
                            {mnemonic
                                ? successed
                                    ? 'このフレーズは利用できます。'
                                    : 'フレーズを確認できません。'
                                : ''}
                        </Text>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton
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
                            インポート
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>戻る</AuthTextButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
