import ReactDOM from 'react-dom/client'
import App from './App'
import { ClientProvider } from './contexts/Client'
import './index.css'
import { ThemeProvider } from './contexts/Theme'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'
import { PreferenceProvider } from './contexts/Preference'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <ClientProvider>
            <PreferenceProvider>
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </PreferenceProvider>
        </ClientProvider>
    </ErrorBoundary>
)
