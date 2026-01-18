import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'

import { ClientProvider } from './contexts/Client'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <ClientProvider>
            <App />
        </ClientProvider>
    </ErrorBoundary>
)
