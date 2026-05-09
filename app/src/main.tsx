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
import { AudioPlayerProvider } from './contexts/AudioPlayer'
import { ImageCropperProvider } from './contexts/ImageCropper'
import { ModalProvider } from './contexts/Modal'
import TickerProvider from './contexts/Ticer'
import { ConfirmProvider } from './contexts/Confirm'
import { EmojiPickerProvider } from './contexts/EmojiPicker'
import { WelcomeView } from './views/Welcome'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <ClientProvider
            loading={<LoadingFull />}
            failed={
                <ModalProvider>
                    <WelcomeView />
                </ModalProvider>
            }
        >
            <PreferenceProvider>
                <ThemeProvider>
                    <ConfirmProvider>
                        <DrawerProvider>
                            <ModalProvider>
                                <SelectProvider>
                                    <EmojiPickerProvider>
                                        <ImageCropperProvider>
                                            <ComposerProvider>
                                                <ScannerProvider>
                                                    <OverlayProvider>
                                                        <MediaViewerProvider>
                                                            <AudioPlayerProvider>
                                                                <TickerProvider>
                                                                    <App />
                                                                </TickerProvider>
                                                            </AudioPlayerProvider>
                                                        </MediaViewerProvider>
                                                    </OverlayProvider>
                                                </ScannerProvider>
                                            </ComposerProvider>
                                        </ImageCropperProvider>
                                    </EmojiPickerProvider>
                                </SelectProvider>
                            </ModalProvider>
                        </DrawerProvider>
                    </ConfirmProvider>
                </ThemeProvider>
            </PreferenceProvider>
        </ClientProvider>
    </ErrorBoundary>
)
