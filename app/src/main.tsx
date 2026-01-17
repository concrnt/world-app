import ReactDOM from 'react-dom/client'
import App from './App'
import { ClientProvider } from './contexts/Client'
import './index.css'
import { ThemeProvider } from './contexts/Theme'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'
import { PreferenceProvider } from './contexts/Preference'
import { SelectProvider } from './contexts/Select'
import { DrawerProvider } from './contexts/Drawer'
import { OverlayProvider } from './contexts/Overlay'
import { ComposerProvider } from './contexts/Composer'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <ClientProvider>
            <PreferenceProvider>
                <ThemeProvider>
                    <DrawerProvider>
                        <SelectProvider>
                            <ComposerProvider>
                                <OverlayProvider>
                                    <App />
                                </OverlayProvider>
                            </ComposerProvider>
                        </SelectProvider>
                    </DrawerProvider>
                </ThemeProvider>
            </PreferenceProvider>
        </ClientProvider>
    </ErrorBoundary>
)
