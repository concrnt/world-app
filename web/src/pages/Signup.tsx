import { useNavigate } from 'react-router-dom'
import { AccountSetup } from '../views/AccountSetup'

const resolveEntrypoint = (): string => {
    const hostname = window.location.hostname
    if (hostname === 'localhost') {
        return 'ariake.concrnt.net'
    }
    return hostname
}

export const Signup = () => {
    const navigate = useNavigate()

    return <AccountSetup entrypoint={resolveEntrypoint()} onBack={() => navigate('/login')} />
}
