import { Fragment, useEffect, useState, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'

import '@fontsource/source-code-pro/400.css'
import '@concrnt/ui/style.css'
import './index.css'
import './i18n'
import { EmergencyKit } from './components/EmergencyKit'
import { ErrorBoundary } from 'react-error-boundary'
import { IsCCID, realtimeDiagnostics } from '@concrnt/client'
import { postPath, profilePath, semantics } from '@concrnt/worldlib'
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
    useSearchParams
} from 'react-router-dom'

import { LoadingFull } from './components/LoadingFull'
import { ClientProvider, useClient, useClientSetupProgress } from './contexts/Client'
import { CachedThemeProvider, ThemeProvider } from './contexts/Theme'
import { PreferenceProvider } from './contexts/Preference'
import { HapticsProvider } from './contexts/Haptics'
import { EmojiPickerProvider } from './contexts/EmojiPicker'
import { ComposerProvider } from './contexts/Composer'
import { ComposerDraftProvider } from './contexts/ComposerDraft'
import { TimelineSearchProvider } from './contexts/TimelineSearch'
import { MediaViewerProvider } from './contexts/MediaViewer'
import { AudioPlayerProvider } from './contexts/AudioPlayer'
import { ImageCropperProvider } from './contexts/ImageCropper'
import TickerProvider from './contexts/Ticer'
import { UrlSummaryProvider } from './contexts/UrlSummary'
import { MediaProxyProvider } from './contexts/MediaProxy'
import { WelcomeView } from './views/Welcome'
import { AppShell } from './pages/App'
import { HomeView } from './views/Home'
import { ExplorerView } from './views/Explorer'
import { NotificationsView } from './views/Notifications'
import { ContactsView } from './views/Contacts'
import { SettingsView } from './views/Settings'
import { NotificationSettingsView } from './views/NotificationSettings'
import { ThemeSettingsView } from './views/ThemeSettings'
import { DisplaySettingsView } from './views/DisplaySettings'
import { FontSizeSettingsView } from './views/FontSizeSettings'
import { IntegrationSettingsView } from './views/IntegrationSettings'
import { LanguageSettingsView } from './views/LanguageSettings'
import { MediaSettingsView } from './views/MediaSettings'
import { InventoryView } from './views/Inventory'
import { MigrationSettingsView } from './views/MigrationSettings'
import { EmojiSettingsView } from './views/EmojiSettings'
import { ProfileView } from './views/Profile'
import { PostView } from './views/Post'
import { TimelineView } from './views/Timeline'
import { ListsView } from './views/Lists'
import { MutedUsersView } from './views/MutedUsers'
import { InvitationSettingsView } from './views/InvitationSettings'
import { ListView } from './views/List'
import { QueryView } from './views/Query'
import { DevView } from './views/Dev'
import { IDView } from './views/ID'
import { Activitypub } from './views/Activitypub'
import { ApView } from './views/ApView'
import { Bluesky } from './views/Bluesky'
import { BskyView } from './views/BskyView'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Signup } from './pages/Signup'
import { WelcomePage } from './pages/Welcome'
import { InvitationPage } from './pages/Invitation'
import { GuestShell } from './views/guest/GuestBase'
import { GuestProfileView } from './views/guest/GuestProfile'
import { GuestPostView } from './views/guest/GuestPost'
import { GuestTimelineView } from './views/guest/GuestTimeline'
import { NavigationProvider } from './contexts/Navigation'
import { KeyboardProvider } from './contexts/Keyboard'
import { GA4Provider } from './contexts/GA4'
import { CommandPaletteProvider } from './contexts/CommandPalette'
import { CssVar, IconButton, OverlayStackProvider, Text } from '@concrnt/ui'
import { ThemeProvider as BaseThemeProvider } from '@concrnt/ui'
import { MdArrowBack } from 'react-icons/md'
import { Themes } from './data/themes'
import { migrateV1Storage } from './lib/v1storage'

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

// /:id[/profile/:profile][/post/:postId]。idは<ccid>か@<alias>。
// ビューはccidの文字列比較で本人・ブロック判定をするので、aliasはここでentityを引いてccidに寄せてから渡す
const IdRoute = ({ guest }: { guest?: boolean }) => {
    const { id = '', profile, postId } = useParams()
    const [searchParams] = useSearchParams()
    const { client } = useClient()
    const [resolved, setResolved] = useState<{ alias: string; ccid?: string; hint?: string }>()

    useEffect(() => {
        if (!id.startsWith('@')) return
        let stale = false
        client.api
            .getEntity(id)
            .then((entity) => {
                if (!stale) setResolved({ alias: id, ccid: entity.author, hint: entity.value.domain })
            })
            .catch(() => {
                if (!stale) setResolved({ alias: id })
            })
        return () => {
            stale = true
        }
    }, [client, id])

    let ccid: string | undefined = id
    // explorer等から未知の外部ユーザーを開くとき、所在ドメインを?hint=で運んで解決に使う
    let hint = searchParams.get('hint') ?? undefined
    if (id.startsWith('@')) {
        if (resolved?.alias !== id) return null
        ccid = resolved.ccid
        hint = resolved.hint
    }
    if (!ccid || !IsCCID(ccid)) return <Navigate to={guest ? '/welcome' : '/'} replace />

    // keyで対象切替時にビューごと再マウントする(タブやドロワー等のstateを持ち越さない)
    if (postId) {
        const uri = semantics.post(ccid, profile ?? 'main', postId)
        return guest ? <GuestPostView key={uri} uri={uri} /> : <PostView key={uri} uri={uri} />
    }
    const key = `${ccid}/${profile ?? ''}`
    return guest ? (
        <GuestProfileView key={key} ccid={ccid} profileName={profile} hint={hint} />
    ) : (
        <ProfileView key={key} ccid={ccid} profileName={profile} hint={hint} />
    )
}

// 旧URL /profile/:ccid/:profile? は現行のパスへ置き換える
const OldProfileRoute = () => {
    const { ccid = '', profile } = useParams()
    const { search } = useLocation()
    return <Navigate to={profilePath(ccid, profile) + search} replace />
}

const UriRoute = ({ kind }: { kind: 'post' | 'timeline' | 'list' | 'apView' | 'bskyView' }) => {
    const { uri = '' } = useParams()
    const decoded = decodeURIComponent(uri)

    // 旧URL /post/<encoded uri> は、短縮形で表せる投稿なら現行のパスへ置き換える
    if (kind === 'post' && !postPath(decoded).startsWith('/post/')) return <Navigate to={postPath(decoded)} replace />

    // keyでuri切替時にビューごと再マウントする。同一ルート内のuri差し替えでマウント済みSuspense配下が
    // サスペンドするとナビゲーションのtransitionがコミットできず画面が旧uriのまま固まるのを防ぐ
    switch (kind) {
        case 'post':
            return <PostView key={decoded} uri={decoded} />
        case 'timeline':
            return <TimelineView key={decoded} uri={decoded} />
        case 'list':
            return <ListView key={decoded} uri={decoded} />
        case 'apView':
            return <ApView key={decoded} uri={decoded} />
        case 'bskyView':
            return <BskyView key={decoded} uri={decoded} />
    }
}

const GuestUriRoute = ({ kind }: { kind: 'post' | 'timeline' }) => {
    const { uri = '' } = useParams()
    const decoded = decodeURIComponent(uri)

    if (kind === 'post' && !postPath(decoded).startsWith('/post/')) return <Navigate to={postPath(decoded)} replace />

    switch (kind) {
        case 'post':
            return <GuestPostView key={decoded} uri={decoded} />
        case 'timeline':
            return <GuestTimelineView key={decoded} uri={decoded} />
    }
}

// v1クライアント(concrnt-world)の残留ストレージはセッション判定より先に変換・掃除する
migrateV1Storage()

// Google Analytics測定ID(v1クライアントと同一)
const GA4_TAG = 'G-Y4V0V7XYWX'

// ログインセッションの有無(モジュールロード時に1回判定)。
// 無い場合のみゲスト閲覧ルートを登録する。ログイン/登録完了時はフルリロードされるため再評価される
const hasSession = (() => {
    // Domainが無くても鍵が残っていればWelcomeView(AuthedRoutesのfailedノード)に入れる。
    // ログアウトはDomain/SubKeyのみ破棄しマスターキーを残すため、ここでDomainを必須にすると
    // ログアウト後の再訪がランディングページに飛ばされ「このアカウントで続行」導線に到達できない
    const masterKey = localStorage.getItem('PrivateKey')
    const subKey = localStorage.getItem('SubKey')
    return !!masterKey || !!subKey
})()

// client(≒プロフィール)が変わったら配下をまるごと作り直し、
// 古いプロフィール由来のstate(タブ選択やビューのローカルstateなど)を持ち越さない。
// BrowserRouterは外側にあるためURLは維持され、ルート要素だけが再構築される
const RemountOnProfileChange = ({ children }: { children: ReactNode }) => {
    const { client } = useClient()
    return <Fragment key={`${client.ccid}:${client.currentProfile}`}>{children}</Fragment>
}

const SettingsBackProvider = ({ children, to = '/settings' }: { children: ReactNode; to?: string }) => {
    const navigate = useNavigate()

    return (
        <NavigationProvider
            backNode={
                <IconButton onClick={() => navigate(to)}>
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
            <CachedThemeProvider>
                <ClientLoadingScreen />
            </CachedThemeProvider>
        }
        failed={
            <CachedThemeProvider>
                {/* WelcomeView内のResetSessionButtonがModal(OverlaySurface)を使うため必要(app版と同構造) */}
                <OverlayStackProvider>
                    <WelcomeView />
                </OverlayStackProvider>
            </CachedThemeProvider>
        }
    >
        <PreferenceProvider>
            <HapticsProvider>
                <ThemeProvider>
                    <MediaProxyProvider>
                        <ImageCropperProvider>
                            <OverlayStackProvider>
                                <CommandPaletteProvider>
                                    <EmojiPickerProvider>
                                        <ComposerDraftProvider>
                                            <TimelineSearchProvider>
                                                <ComposerProvider>
                                                    <MediaViewerProvider
                                                        renderPost={(uri) => <PostView uri={uri} embedded />}
                                                    >
                                                        <AudioPlayerProvider>
                                                            <TickerProvider>
                                                                <UrlSummaryProvider>
                                                                    <RemountOnProfileChange>
                                                                        <Routes>
                                                                            <Route path="/" element={<AppShell />}>
                                                                                <Route index element={<HomeView />} />
                                                                                <Route
                                                                                    path="explorer"
                                                                                    element={<ExplorerView />}
                                                                                />
                                                                                <Route
                                                                                    path="notifications"
                                                                                    element={<NotificationsView />}
                                                                                />
                                                                                <Route
                                                                                    path="contacts"
                                                                                    element={<ContactsView />}
                                                                                />
                                                                                <Route
                                                                                    path="settings"
                                                                                    element={<SettingsView />}
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
                                                                                    path="settings/notifications"
                                                                                    element={
                                                                                        <SettingsBackProvider>
                                                                                            <NotificationSettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/lists"
                                                                                    element={
                                                                                        <SettingsBackProvider>
                                                                                            <ListsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/muted"
                                                                                    element={
                                                                                        <SettingsBackProvider>
                                                                                            <MutedUsersView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/invitation"
                                                                                    element={
                                                                                        <SettingsBackProvider>
                                                                                            <InvitationSettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/display"
                                                                                    element={
                                                                                        <SettingsBackProvider>
                                                                                            <DisplaySettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/language"
                                                                                    element={
                                                                                        <SettingsBackProvider to="/settings/display">
                                                                                            <LanguageSettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/theme"
                                                                                    element={
                                                                                        <SettingsBackProvider to="/settings/display">
                                                                                            <ThemeSettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/fontsize"
                                                                                    element={
                                                                                        <SettingsBackProvider to="/settings/display">
                                                                                            <FontSizeSettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/emoji"
                                                                                    element={
                                                                                        <SettingsBackProvider to="/settings/display">
                                                                                            <EmojiSettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/media"
                                                                                    element={
                                                                                        <SettingsBackProvider>
                                                                                            <MediaSettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/integrations"
                                                                                    element={
                                                                                        <SettingsBackProvider>
                                                                                            <IntegrationSettingsView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/activitypub"
                                                                                    element={
                                                                                        <SettingsBackProvider to="/settings/integrations">
                                                                                            <Activitypub />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/bluesky"
                                                                                    element={
                                                                                        <SettingsBackProvider to="/settings/integrations">
                                                                                            <Bluesky />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="settings/migration"
                                                                                    element={
                                                                                        <SettingsBackProvider to="/settings/id">
                                                                                            <MigrationSettingsView />
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
                                                                                    path="settings/inventory"
                                                                                    element={
                                                                                        <SettingsBackProvider to="/settings/dev">
                                                                                            <InventoryView />
                                                                                        </SettingsBackProvider>
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="profile/:ccid/:profile?"
                                                                                    element={<OldProfileRoute />}
                                                                                />
                                                                                <Route
                                                                                    path=":id"
                                                                                    element={<IdRoute />}
                                                                                />
                                                                                <Route
                                                                                    path=":id/profile/:profile"
                                                                                    element={<IdRoute />}
                                                                                />
                                                                                <Route
                                                                                    path=":id/post/:postId"
                                                                                    element={<IdRoute />}
                                                                                />
                                                                                <Route
                                                                                    path=":id/profile/:profile/post/:postId"
                                                                                    element={<IdRoute />}
                                                                                />
                                                                                <Route
                                                                                    path="post/:uri"
                                                                                    element={<UriRoute kind="post" />}
                                                                                />
                                                                                <Route
                                                                                    path="timeline/:uri"
                                                                                    element={
                                                                                        <UriRoute kind="timeline" />
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="lists"
                                                                                    element={<ListsView />}
                                                                                />
                                                                                <Route
                                                                                    path="lists/:uri"
                                                                                    element={<UriRoute kind="list" />}
                                                                                />
                                                                                <Route
                                                                                    path="query"
                                                                                    element={<QueryView />}
                                                                                />
                                                                                <Route
                                                                                    path="dev"
                                                                                    element={
                                                                                        <Navigate
                                                                                            to="/settings/dev"
                                                                                            replace
                                                                                        />
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="id"
                                                                                    element={
                                                                                        <Navigate
                                                                                            to="/settings/id"
                                                                                            replace
                                                                                        />
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="activitypub"
                                                                                    element={
                                                                                        <Navigate
                                                                                            to="/settings/activitypub"
                                                                                            replace
                                                                                        />
                                                                                    }
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
                                                                                <Route
                                                                                    path="bluesky"
                                                                                    element={
                                                                                        <Navigate
                                                                                            to="/settings/bluesky"
                                                                                            replace
                                                                                        />
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="bluesky/person/:uri"
                                                                                    element={
                                                                                        <UriRoute kind="bskyView" />
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="bluesky/post/:uri"
                                                                                    element={
                                                                                        <UriRoute kind="bskyView" />
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="bluesky/view/:uri"
                                                                                    element={
                                                                                        <UriRoute kind="bskyView" />
                                                                                    }
                                                                                />
                                                                                <Route
                                                                                    path="*"
                                                                                    element={
                                                                                        <Navigate to="/" replace />
                                                                                    }
                                                                                />
                                                                            </Route>
                                                                        </Routes>
                                                                    </RemountOnProfileChange>
                                                                </UrlSummaryProvider>
                                                            </TickerProvider>
                                                        </AudioPlayerProvider>
                                                    </MediaViewerProvider>
                                                </ComposerProvider>
                                            </TimelineSearchProvider>
                                        </ComposerDraftProvider>
                                    </EmojiPickerProvider>
                                </CommandPaletteProvider>
                            </OverlayStackProvider>
                        </ImageCropperProvider>
                    </MediaProxyProvider>
                </ThemeProvider>
            </HapticsProvider>
        </PreferenceProvider>
    </ClientProvider>
)

// Dev画面へ遷移するとタイムラインのreaderがdisposeされるので、新着が止まった画面のままDevToolsのconsoleから呼べるようにする
Object.assign(window, { realtimeDiagnostics })

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ErrorBoundary FallbackComponent={EmergencyKit}>
        <KeyboardProvider>
            <BrowserRouter>
                <GA4Provider tag={GA4_TAG}>
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
                        <Route
                            path="/signup"
                            element={
                                <BaseThemeProvider theme={Themes.blue}>
                                    <Signup />
                                </BaseThemeProvider>
                            }
                        />
                        <Route path="/welcome" element={<WelcomePage />} />
                        <Route
                            path="/invitation/:ccid/:id"
                            element={
                                <BaseThemeProvider theme={Themes.blue}>
                                    <OverlayStackProvider>
                                        <InvitationPage />
                                    </OverlayStackProvider>
                                </BaseThemeProvider>
                            }
                        />
                        <Route
                            path="/crash"
                            element={<EmergencyKit error={new Error('Test crash')} resetErrorBoundary={() => {}} />}
                        />
                        {!hasSession && (
                            <Route element={<GuestShell />}>
                                <Route path="/profile/:ccid/:profile?" element={<OldProfileRoute />} />
                                <Route path="/:id" element={<IdRoute guest />} />
                                <Route path="/:id/profile/:profile" element={<IdRoute guest />} />
                                <Route path="/:id/post/:postId" element={<IdRoute guest />} />
                                <Route path="/:id/profile/:profile/post/:postId" element={<IdRoute guest />} />
                                <Route path="/post/:uri" element={<GuestUriRoute kind="post" />} />
                                <Route path="/timeline/:uri" element={<GuestUriRoute kind="timeline" />} />
                            </Route>
                        )}
                        {hasSession ? (
                            <Route path="*" element={<AuthedRoutes />} />
                        ) : (
                            <Route path="*" element={<Navigate to="/welcome" replace />} />
                        )}
                    </Routes>
                </GA4Provider>
            </BrowserRouter>
        </KeyboardProvider>
    </ErrorBoundary>
)
