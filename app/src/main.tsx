import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'
import { ScannerProvider } from './contexts/Scanner'

import { LoadingFull } from './components/LoadingFull'
import { ClientProvider } from './contexts/Client'
import { ThemeProvider } from './contexts/Theme'
import { PreferenceProvider } from './contexts/Preference'
import { SelectProvider } from './contexts/Select'
import { DrawerProvider } from './contexts/Drawer'
import { OverlayProvider } from './contexts/Overlay'
import { ComposerProvider } from './contexts/Composer'
import { MediaViewerProvider } from './contexts/MediaViewer'
import { ImageCropperProvider } from './contexts/ImageCropper'
import TickerProvider from './contexts/Ticer'
import { ConfirmProvider } from './contexts/Confirm'
import { WelcomeView } from './views/Welcome'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <ClientProvider
            loading={<LoadingFull />}
            failed={
                <ThemeProvider>
                    <WelcomeView />
                </ThemeProvider>
            }
        >
            <PreferenceProvider>
                <ThemeProvider>
                    <ConfirmProvider>
                        <ImageCropperProvider>
                            <DrawerProvider>
                                <SelectProvider>
                                    <ComposerProvider>
                                        <ScannerProvider>
                                            <OverlayProvider>
                                                <MediaViewerProvider>
                                                    <TickerProvider>
                                                        <App />
                                                    </TickerProvider>
                                                </MediaViewerProvider>
                                            </OverlayProvider>
                                        </ScannerProvider>
                                    </ComposerProvider>
                                </SelectProvider>
                            </DrawerProvider>
                        </ImageCropperProvider>
                    </ConfirmProvider>
                </ThemeProvider>
            </PreferenceProvider>
        </ClientProvider>
    </ErrorBoundary>
)
