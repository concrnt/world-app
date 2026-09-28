import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { DrawerMenu } from '../components/DrawerMenu'
import { SidebarLayout } from '../layouts/Sidebar'
import { SwipableView } from '../layouts/Stack'
import { AccountSwitchingBanner } from '../components/AccountSwitchingBanner'
import { PwaManager } from '../components/PwaManager'
import { NavigationProvider } from '../contexts/Navigation'
import { CssVar } from '../types/Theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { useNotificationCounter } from '../hooks/useNotificationCounter'
import { useClient } from '../contexts/Client'
import { setAppBadge } from '../lib/push'
import { Badge, IconButton, Tabs, Tab, useTheme } from '@concrnt/ui'
import { MdArrowBack, MdHome, MdExplore, MdNotifications, MdContacts } from 'react-icons/md'

export const AppShell = () => {
    const isMobile = useIsMobile()
    return isMobile ? <MobileShell /> : <DesktopShell />
}

const DesktopShell = () => {
    const location = useLocation()
    // ルートが変わったら、伸びたページのスクロール位置を先頭に戻す
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [location.pathname, location.hash])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100vw',
                minHeight: '100dvh',
                boxSizing: 'border-box',
                backgroundColor: CssVar.backdropBackground,
                alignItems: 'center'
            }}
        >
            <PwaManager />
            <AccountSwitchingBanner />
            <div
                style={{
                    display: 'flex',
                    flex: '1 0 auto',
                    maxWidth: '1280px',
                    width: '100%',
                    justifyContent: 'center',
                    alignItems: 'stretch'
                }}
            >
                <aside
                    style={{
                        width: '200px',
                        margin: CssVar.space(2)
                    }}
                >
                    <div
                        style={{
                            position: 'sticky',
                            top: CssVar.space(2),
                            height: `calc(100dvh - ${CssVar.space(2)} * 2)`,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <Sidebar />
                    </div>
                </aside>
                <main
                    style={{
                        display: 'flex',
                        // basisをautoにすると幅が中身のmax-contentに追従し、読み込み後に横へ広がる
                        flex: '1 1 0',
                        maxWidth: '720px',
                        minWidth: 0
                    }}
                >
                    <div
                        style={{
                            flexGrow: '1',
                            minWidth: 0,
                            margin: CssVar.space(2),
                            display: 'flex',
                            flexFlow: 'column',
                            borderRadius: CssVar.round(2),
                            background: 'none'
                        }}
                    >
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}

// app版のボトムタブ(app/src/views/Main.tsx)と同じ4項目
const TABS = [
    { path: '/', icon: <MdHome size={24} /> },
    { path: '/explorer', icon: <MdExplore size={24} /> },
    { path: '/notifications', icon: <MdNotifications size={24} /> },
    { path: '/contacts', icon: <MdContacts size={24} /> }
]

const MobileBackButton = () => {
    const navigate = useNavigate()
    return (
        <IconButton
            onClick={() => {
                // 共有リンク直開きやリロード直後は履歴が無いのでホームへ逃がす
                if ((window.history.state?.idx ?? 0) > 0) {
                    navigate(-1)
                } else {
                    navigate('/', { replace: true })
                }
            }}
        >
            <MdArrowBack size={24} />
        </IconButton>
    )
}

const MobileShell = () => {
    const [opened, setOpen] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()
    const theme = useTheme()
    const { client } = useClient()
    // 未読通知数はサーバーのカウンターが正(web/appで同期)。インストール済みPWAのアイコンにも追従
    const unreadCount = useNotificationCounter(client)
    useEffect(() => {
        if (!client) return
        setAppBadge(unreadCount)
    }, [client, unreadCount])

    const isTabRoot = TABS.some((tab) => tab.path === location.pathname)

    const goBack = () => {
        // 共有リンク直開きやリロード直後は履歴が無いのでホームへ逃がす
        if ((window.history.state?.idx ?? 0) > 0) {
            navigate(-1)
        } else {
            navigate('/', { replace: true })
        }
    }

    // どこ経由の遷移でもドロワーを閉じる
    const [prevPathname, setPrevPathname] = useState(location.pathname)
    if (prevPathname !== location.pathname) {
        setPrevPathname(location.pathname)
        setOpen(false)
    }

    return (
        <div
            style={{
                width: '100vw',
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: CssVar.backdropBackground
            }}
        >
            <PwaManager />
            <AccountSwitchingBanner />
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <SidebarLayout
                    opened={opened}
                    setOpen={setOpen}
                    content={<DrawerMenu onClose={() => setOpen(false)} />}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            backgroundColor: CssVar.backdropBackground
                        }}
                    >
                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {isTabRoot ? (
                                <Outlet />
                            ) : (
                                <SwipableView key={location.pathname} onPop={goBack}>
                                    <NavigationProvider backNode={<MobileBackButton />}>
                                        <Outlet />
                                    </NavigationProvider>
                                </SwipableView>
                            )}
                        </div>
                        <Tabs
                            style={{
                                paddingBottom: 'env(safe-area-inset-bottom)',
                                borderTop: theme.variant === 'classic' ? `1px solid ${CssVar.divider}` : undefined,
                                borderBottom: 'none'
                            }}
                        >
                            {TABS.map((tab) => (
                                <Tab
                                    key={tab.path}
                                    groupId="bottom-tabs"
                                    selected={location.pathname === tab.path}
                                    onClick={() => navigate(tab.path)}
                                    style={{
                                        color: CssVar.backdropText,
                                        padding: '0.5rem'
                                    }}
                                >
                                    {tab.path === '/notifications' ? (
                                        <Badge
                                            count={unreadCount}
                                            style={{
                                                backgroundColor: CssVar.backdropText,
                                                color: CssVar.backdropBackground
                                            }}
                                        >
                                            {tab.icon}
                                        </Badge>
                                    ) : (
                                        tab.icon
                                    )}
                                </Tab>
                            ))}
                        </Tabs>
                    </div>
                </SidebarLayout>
            </div>
        </div>
    )
}

export const App = AppShell
