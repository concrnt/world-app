import type { ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'

import { LoadingFull } from './components/LoadingFull'
import { ClientProvider, useClientSetupProgress } from './contexts/Client'
import { ThemeProvider } from './contexts/Theme'
import { PreferenceProvider } from './contexts/Preference'
import { EmojiPickerProvider } from './contexts/EmojiPicker'
import { ComposerProvider } from './contexts/Composer'
import { MediaViewerProvider } from './contexts/MediaViewer'
import { AudioPlayerProvider } from './contexts/AudioPlayer'
import { ImageCropperProvider } from './contexts/ImageCropper'
import TickerProvider from './contexts/Ticer'
import { UrlSummaryProvider } from './contexts/UrlSummary'
import { WelcomeView } from './views/Welcome'
import { AppShell } from './pages/App'
import { HomeView } from './views/Home'
import { ExplorerView } from './views/Explorer'
import { NotificationsView } from './views/Notifications'
import { ContactsView } from './views/Contacts'
import { SettingsView } from './views/Settings'
import { NotificationSettingsView } from './views/NotificationSettings'
import { ThemeSettingsView } from './views/ThemeSettings'
import { EmojiSettingsView } from './views/EmojiSettings'
import { ProfileView } from './views/Profile'
import { PostView } from './views/Post'
import { TimelineView } from './views/Timeline'
import { ListsView } from './views/Lists'
import { QueryView } from './views/Query'
import { DevView } from './views/Dev'
import { IDView } from './views/ID'
import { Activitypub } from './views/Activitypub'
import { ApView } from './views/ApView'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { GuestShell } from './views/guest/GuestBase'
import { GuestProfileView } from './views/guest/GuestProfile'
import { GuestPostView } from './views/guest/GuestPost'
import { GuestTimelineView } from './views/guest/GuestTimeline'
import { NavigationProvider } from './contexts/Navigation'
import { CssVar, IconButton, OverlayStackProvider, Text } from '@concrnt/ui'
import { ThemeProvider as BaseThemeProvider } from '@concrnt/ui'
import { MdArrowBack } from 'react-icons/md'
import { Themes } from './data/themes'

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

const ProfileRoute = () => {
    const { ccid = '', profile } = useParams()
    return <ProfileView ccid={ccid} profileName={profile} />
}

const UriRoute = ({ kind }: { kind: 'post' | 'timeline' | 'apView' }) => {
    const { uri = '' } = useParams()
    const decoded = decodeURIComponent(uri)

    switch (kind) {
        case 'post':
            return <PostView uri={decoded} />
        case 'timeline':
            return <TimelineView uri={decoded} />
        case 'apView':
            return <ApView uri={decoded} />
    }
}

const GuestProfileRoute = () => {
    const { ccid = '', profile } = useParams()
    return <GuestProfileView ccid={ccid} profileName={profile} />
}

const GuestUriRoute = ({ kind }: { kind: 'post' | 'timeline' }) => {
    const { uri = '' } = useParams()
    const decoded = decodeURIComponent(uri)

    switch (kind) {
        case 'post':
            return <GuestPostView uri={decoded} />
        case 'timeline':
            return <GuestTimelineView uri={decoded} />
    }
}

// ログインセッションの有無(モジュールロード時に1回判定)。
// 無い場合のみゲスト閲覧ルートを登録する。ログイン/登録完了時はフルリロードされるため再評価される
const hasSession = (() => {
    const domain = localStorage.getItem('Domain')
    const masterKey = localStorage.getItem('PrivateKey')
    const subKey = localStorage.getItem('SubKey')
    return !!domain && (!!masterKey || !!subKey)
})()

const SettingsBackProvider = ({ children }: { children: ReactNode }) => {
    const navigate = useNavigate()

    return (
        <NavigationProvider
            backNode={
                <IconButton onClick={() => navigate('/settings')}>
                    <MdArrowBack size={24} />
                </IconButton>
            }
        >
            {children}
        </NavigationProvider>
    )
}

const AuthedRoutes = () => (
    <ClientProvider
        loading={
            <BaseThemeProvider theme={Themes.blue}>
                <ClientLoadingScreen />
            </BaseThemeProvider>
        }
        failed={
            <BaseThemeProvider theme={Themes.blue}>
                <WelcomeView />
            </BaseThemeProvider>
        }
    >
        <PreferenceProvider>
            <ThemeProvider>
                <ImageCropperProvider>
                    <OverlayStackProvider>
                        <EmojiPickerProvider>
                            <ComposerProvider>
                                <MediaViewerProvider>
                                    <AudioPlayerProvider>
                                        <TickerProvider>
                                            <UrlSummaryProvider>
                                                <Routes>
                                                    <Route path="/" element={<AppShell />}>
                                                        <Route index element={<HomeView />} />
                                                        <Route path="explorer" element={<ExplorerView />} />
                                                        <Route path="notifications" element={<NotificationsView />} />
                                                        <Route path="contacts" element={<ContactsView />} />
                                                        <Route path="settings" element={<SettingsView />} />
                                                        <Route
                                                            path="settings/theme"
                                                            element={
                                                                <SettingsBackProvider>
                                                                    <ThemeSettingsView />
                                                                </SettingsBackProvider>
                                                            }
                                                        />
                                                        <Route
                                                            path="settings/notifications"
                                                            element={
                                                                <SettingsBackProvider>
                                                                    <NotificationSettingsView />
                                                                </SettingsBackProvider>
                                                            }
                                                        />
                                                        <Route
                                                            path="settings/activitypub"
                                                            element={
                                                                <SettingsBackProvider>
                                                                    <Activitypub />
                                                                </SettingsBackProvider>
                                                            }
                                                        />
                                                        <Route
                                                            path="settings/id"
                                                            element={
                                                                <SettingsBackProvider>
                                                                    <IDView />
                                                                </SettingsBackProvider>
                                                            }
                                                        />
                                                        <Route
                                                            path="settings/emoji"
                                                            element={
                                                                <SettingsBackProvider>
                                                                    <EmojiSettingsView />
                                                                </SettingsBackProvider>
                                                            }
                                                        />
                                                        <Route
                                                            path="settings/dev"
                                                            element={
                                                                <SettingsBackProvider>
                                                                    <DevView />
                                                                </SettingsBackProvider>
                                                            }
                                                        />
                                                        <Route
                                                            path="profile/:ccid/:profile?"
                                                            element={<ProfileRoute />}
                                                        />
                                                        <Route path="post/:uri" element={<UriRoute kind="post" />} />
                                                        <Route
                                                            path="timeline/:uri"
                                                            element={<UriRoute kind="timeline" />}
                                                        />
                                                        <Route path="lists" element={<ListsView />} />
                                                        <Route path="lists/:uri" element={<ListsView />} />
                                                        <Route path="query" element={<QueryView />} />
                                                        <Route
                                                            path="dev"
                                                            element={<Navigate to="/settings/dev" replace />}
                                                        />
                                                        <Route
                                                            path="id"
                                                            element={<Navigate to="/settings/id" replace />}
                                                        />
                                                        <Route
                                                            path="activitypub"
                                                            element={<Navigate to="/settings/activitypub" replace />}
                                                        />
                                                        <Route
                                                            path="activitypub/person/:uri"
                                                            element={<UriRoute kind="apView" />}
                                                        />
                                                        <Route
                                                            path="activitypub/note/:uri"
                                                            element={<UriRoute kind="apView" />}
                                                        />
                                                        <Route
                                                            path="activitypub/view/:uri"
                                                            element={<UriRoute kind="apView" />}
                                                        />
                                                        <Route path="*" element={<Navigate to="/" replace />} />
                                                    </Route>
                                                </Routes>
                                            </UrlSummaryProvider>
                                        </TickerProvider>
                                    </AudioPlayerProvider>
                                </MediaViewerProvider>
                            </ComposerProvider>
                        </EmojiPickerProvider>
                    </OverlayStackProvider>
                </ImageCropperProvider>
            </ThemeProvider>
        </PreferenceProvider>
    </ClientProvider>
)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <BrowserRouter>
            <Routes>
                <Route
                    path="/login"
                    element={
                        <BaseThemeProvider theme={Themes.blue}>
                            <Login />
                        </BaseThemeProvider>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <BaseThemeProvider theme={Themes.blue}>
                            <Register />
                        </BaseThemeProvider>
                    }
                />
                {!hasSession && (
                    <Route element={<GuestShell />}>
                        <Route path="/profile/:ccid/:profile?" element={<GuestProfileRoute />} />
                        <Route path="/post/:uri" element={<GuestUriRoute kind="post" />} />
                        <Route path="/timeline/:uri" element={<GuestUriRoute kind="timeline" />} />
                    </Route>
                )}
                <Route path="*" element={<AuthedRoutes />} />
            </Routes>
        </BrowserRouter>
    </ErrorBoundary>
)
