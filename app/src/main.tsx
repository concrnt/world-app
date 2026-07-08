import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'
import { ScannerProvider } from './contexts/Scanner'

import { LoadingFull } from './components/LoadingFull'
import { ClientProvider, useClientSetupProgress } from './contexts/Client'
import { ThemeProvider } from './contexts/Theme'
import { PreferenceProvider } from './contexts/Preference'
import { OverlayProvider } from './contexts/Overlay'
import { ComposerProvider } from './contexts/Composer'
import { MediaViewerProvider } from './contexts/MediaViewer'
import { AudioPlayerProvider } from './contexts/AudioPlayer'
import { ImageCropperProvider } from './contexts/ImageCropper'
import TickerProvider from './contexts/Ticer'
import { EmojiPickerProvider } from './contexts/EmojiPicker'
import { WelcomeView } from './views/Welcome'
import { UrlSummaryProvider } from './contexts/UrlSummary'
import { KeyboardProvider } from './contexts/Keyboard'
import { CssVar, OverlayStackProvider, Text } from '@concrnt/ui'

const ClientLoadingScreen = () => {
    const progress = useClientSetupProgress()
    return (
        <LoadingFull>
            <Text
                style={{
                    color: CssVar.uiText,
                    fontSize: '14px'
                }}
            >
                {progress}
            </Text>
        </LoadingFull>
    )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <KeyboardProvider>
            <ClientProvider
                loading={<ClientLoadingScreen />}
                failed={
                    <OverlayStackProvider>
                        <WelcomeView />
                    </OverlayStackProvider>
                }
            >
                <PreferenceProvider>
                    <ThemeProvider>
                        <ImageCropperProvider>
                            <OverlayStackProvider>
                                <EmojiPickerProvider>
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
                                </EmojiPickerProvider>
                            </OverlayStackProvider>
                        </ImageCropperProvider>
                    </ThemeProvider>
                </PreferenceProvider>
            </ClientProvider>
        </KeyboardProvider>
    </ErrorBoundary>
)
