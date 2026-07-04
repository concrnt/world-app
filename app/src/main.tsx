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
import { UrlSummaryProvider } from './contexts/UrlSummary'
import { KeyboardProvider } from './contexts/Keyboard'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <KeyboardProvider>
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
                            <SelectProvider>
                                <DrawerProvider>
                                    <ModalProvider>
                                        <EmojiPickerProvider>
                                            <ImageCropperProvider>
                                                <ComposerProvider>
                                                    <ScannerProvider>
                                                        <OverlayProvider>
                                                            <MediaViewerProvider>
                                                                <AudioPlayerProvider>
                                                                    <TickerProvider>
                                                                        <UrlSummaryProvider>
                                                                            <App />
                                                                        </UrlSummaryProvider>
                                                                    </TickerProvider>
                                                                </AudioPlayerProvider>
                                                            </MediaViewerProvider>
                                                        </OverlayProvider>
                                                    </ScannerProvider>
                                                </ComposerProvider>
                                            </ImageCropperProvider>
                                        </EmojiPickerProvider>
                                    </ModalProvider>
                                </DrawerProvider>
                            </SelectProvider>
                        </ConfirmProvider>
                    </ThemeProvider>
                </PreferenceProvider>
            </ClientProvider>
        </KeyboardProvider>
    </ErrorBoundary>
)
