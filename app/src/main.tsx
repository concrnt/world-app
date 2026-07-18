import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'
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
import { MediaProxyProvider } from './contexts/MediaProxy'
import { KeyboardProvider } from './contexts/Keyboard'
import { BackHandlerProvider } from './contexts/BackHandler'
import { OverlayStackBackBridge } from './components/OverlayStackBackBridge'
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
            <BackHandlerProvider>
                <ClientProvider
                    loading={<ClientLoadingScreen />}
                    failed={
                        <OverlayStackProvider>
                            <OverlayStackBackBridge />
                            <WelcomeView />
                        </OverlayStackProvider>
                    }
                >
                    <PreferenceProvider>
                        <ThemeProvider>
                            <MediaProxyProvider>
                                <ImageCropperProvider>
                                    <OverlayStackProvider>
                                        <OverlayStackBackBridge />
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
                            </MediaProxyProvider>
                        </ThemeProvider>
                    </PreferenceProvider>
                </ClientProvider>
            </BackHandlerProvider>
        </KeyboardProvider>
    </ErrorBoundary>
)
