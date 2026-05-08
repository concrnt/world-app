import ReactDOM from 'react-dom/client'
import './index.css'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'

import { LoadingFull } from './components/LoadingFull'
import { ClientProvider } from './contexts/Client'
import { ThemeProvider } from './contexts/Theme'
import { PreferenceProvider } from './contexts/Preference'
import { SelectProvider } from './contexts/Select'
import { DrawerProvider } from './contexts/Drawer'
import { EmojiPickerProvider } from './contexts/EmojiPicker'
import { ComposerProvider } from './contexts/Composer'
import { MediaViewerProvider } from './contexts/MediaViewer'
import { AudioPlayerProvider } from './contexts/AudioPlayer'
import { ImageCropperProvider } from './contexts/ImageCropper'
import TickerProvider from './contexts/Ticer'
import { ConfirmProvider } from './contexts/Confirm'
import { WelcomeView } from './views/Welcome'
import { AppShell } from './pages/App'
import { HomeView } from './views/Home'
import { ExplorerView } from './views/Explorer'
import { NotificationsView } from './views/Notifications'
import { ContactsView } from './views/Contacts'
import { SettingsView } from './views/Settings'
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

const AuthedRoutes = () => (
    <ClientProvider loading={<LoadingFull />} failed={<WelcomeView />}>
        <ConfirmProvider>
            <ImageCropperProvider>
                <DrawerProvider>
                    <SelectProvider>
                        <EmojiPickerProvider>
                            <ComposerProvider>
                                <MediaViewerProvider>
                                    <AudioPlayerProvider>
                                        <TickerProvider>
                                            <Routes>
                                                <Route path="/" element={<AppShell />}>
                                                    <Route index element={<HomeView />} />
                                                    <Route path="explorer" element={<ExplorerView />} />
                                                    <Route path="notifications" element={<NotificationsView />} />
                                                    <Route path="contacts" element={<ContactsView />} />
                                                    <Route path="settings" element={<SettingsView />} />
                                                    <Route path="profile/:ccid/:profile?" element={<ProfileRoute />} />
                                                    <Route path="post/:uri" element={<UriRoute kind="post" />} />
                                                    <Route
                                                        path="timeline/:uri"
                                                        element={<UriRoute kind="timeline" />}
                                                    />
                                                    <Route path="lists" element={<ListsView />} />
                                                    <Route path="lists/:uri" element={<ListsView />} />
                                                    <Route path="query" element={<QueryView />} />
                                                    <Route path="dev" element={<DevView />} />
                                                    <Route path="id" element={<IDView />} />
                                                    <Route path="activitypub" element={<Activitypub />} />
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
                                        </TickerProvider>
                                    </AudioPlayerProvider>
                                </MediaViewerProvider>
                            </ComposerProvider>
                        </EmojiPickerProvider>
                    </SelectProvider>
                </DrawerProvider>
            </ImageCropperProvider>
        </ConfirmProvider>
    </ClientProvider>
)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <BrowserRouter>
            <PreferenceProvider>
                <ThemeProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="*" element={<AuthedRoutes />} />
                    </Routes>
                </ThemeProvider>
            </PreferenceProvider>
        </BrowserRouter>
    </ErrorBoundary>
)
