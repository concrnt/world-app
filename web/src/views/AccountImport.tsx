import { Text, TextField } from '@concrnt/ui'
import { useEffect, useMemo, useState } from 'react'
import { LoadIdentity } from '@concrnt/client'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'

interface Props {
    onBack?: () => void
    onImported?: () => void
}

export const AccountImport = (props: Props) => {
    const [mnemonic, setMnemonic] = useState<string>('')
    const [update, setUpdate] = useState<number>(0)

    const existingMaster = localStorage.getItem('PrivateKey')
    const identity = useMemo(() => LoadIdentity(mnemonic), [mnemonic])

    useEffect(() => {}, [update])

    return (
        <AuthScreen align="top">
            {existingMaster ? (
                <>
                    <AuthHeader
                        title="保存済みアカウントがあります"
                        description="新しくインポートするには、ブラウザに保存されたアカウント情報を先に削除する必要があります。"
                    />
                    <div style={authStyles.section}>
                        <Text style={authStyles.ccid}>このブラウザには既にマスターキーがあります。</Text>
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
                            ブラウザのアカウント情報を削除
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>戻る</AuthTextButton>
                    </AuthActions>
                </>
            ) : (
                <>
                    <AuthHeader
                        title="アカウントをインポート"
                        description="マスターキーを入力して、このブラウザでアカウントを使えるようにします。"
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
                                ? identity
                                    ? 'このマスターキーは利用できます。'
                                    : 'マスターキーを確認できません。'
                                : ''}
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
                            インポート
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>戻る</AuthTextButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
