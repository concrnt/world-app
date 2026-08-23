import { resolveEntrypoint } from '../utils/entrypoint'
import { useNavigate } from 'react-router-dom'
import { AccountSetup } from '../views/AccountSetup'

export const Signup = () => {
    const navigate = useNavigate()

    return <AccountSetup entrypoint={resolveEntrypoint()} onBack={() => navigate('/login')} />
}
