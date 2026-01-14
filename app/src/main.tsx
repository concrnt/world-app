import ReactDOM from 'react-dom/client'
import App from './App'
import { ClientProvider } from './contexts/Client'
import './index.css'
import { ThemeProvider } from './contexts/Theme'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <ClientProvider>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </ClientProvider>
    </ErrorBoundary>
)
