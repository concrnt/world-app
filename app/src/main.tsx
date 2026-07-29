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
import { PreferenceProvider, type Preference } from './contexts/Preference'
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
import { AgeGateProvider } from './contexts/AgeGate'
import { CssVar, OverlayStackProvider, Text, ThemeProvider as BaseThemeProvider } from '@concrnt/ui'
import { Themes } from './data/themes'
import { type Theme } from './types/Theme'
import { usePersistent } from './hooks/usePersistent'
import { type ReactNode } from 'react'

// 設定(cckv)ロード前でも、前回解決されたテーマのキャッシュ(cachedTheme)から前回のテーマを引く。
// キャッシュ未生成時はpreferenceのテーマ名をビルトインから引き、それも無ければblue
const CachedThemeProvider = ({ children }: { children: ReactNode }) => {
    const [cachedPref] = usePersistent<Preference>('preference')
    const [cachedTheme] = usePersistent<Theme>('cachedTheme')
    return (
        <BaseThemeProvider theme={cachedTheme ?? Themes[cachedPref?.themeName ?? ''] ?? Themes.blue}>
            {children}
        </BaseThemeProvider>
    )
}

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
        {/* AgeGateやClientProviderのローディング画面はThemeProviderの外にあるため、
            ここで前回のテーマを適用しておく。本来のThemeProviderがマウントされると
            CSS変数が上書きされ実際のテーマが優先される */}
        <CachedThemeProvider>
            <KeyboardProvider>
                <BackHandlerProvider>
                    <AgeGateProvider>
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
                    </AgeGateProvider>
                </BackHandlerProvider>
            </KeyboardProvider>
        </CachedThemeProvider>
    </ErrorBoundary>
)
