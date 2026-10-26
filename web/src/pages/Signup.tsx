import { resolveEntrypoint } from '../utils/entrypoint'
import { useNavigate } from 'react-router-dom'
import { AccountSetup } from '../views/AccountSetup'
import { isConcrntWorld, SignupWithApp } from './SignupWithApp'

// セルフホスト(web がサーバー自身にホストされている)では鍵をアプリで作る QR フローを主経路にする。
// concrnt.world / localhost はサーバーではないので従来のサーバー選択 + ブラウザ内鍵生成のまま
export const Signup = () => {
    if (isConcrntWorld()) return <SignupInBrowser />
    return <SignupWithApp />
}

export const SignupInBrowser = () => {
    const navigate = useNavigate()

    return (
        <AccountSetup
            entrypoint={resolveEntrypoint()}
            onBack={() => navigate(isConcrntWorld() ? '/login' : '/signup')}
        />
    )
}
