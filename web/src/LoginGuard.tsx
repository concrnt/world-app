import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { ClientStatusScreen } from './components/ClientStatusScreen'
import { useClient } from './contexts/Client'

interface Props {
    children: ReactNode
    redirect: string
}

export const LoginGuard = (props: Props) => {
    const { status, error, reload, logout } = useClient()

    if (status === 'loading') {
        return <ClientStatusScreen title="Concrnt" description="保存されているセッションを確認しています。" />
    }

    if (status === 'failed') {
        return (
            <ClientStatusScreen
                title="接続できませんでした"
                description={error ?? 'クライアントの初期化に失敗しました。'}
                primaryLabel="再試行"
                onPrimary={() => {
                    void reload()
                }}
                secondaryLabel="保存済みセッションを破棄する"
                onSecondary={() => {
                    void logout()
                }}
            />
        )
    }

    if (status !== 'ready') {
        return <Navigate to={props.redirect} replace={true} />
    }

    return props.children
}
