import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { DrawerMenu } from '../components/DrawerMenu'
import { SidebarLayout } from '../layouts/Sidebar'
import { SwipableView } from '../layouts/Stack'
import { DomainOfflineBanner } from '../components/DomainOfflineBanner'
import { PwaManager } from '../components/PwaManager'
import { NavigationProvider } from '../contexts/Navigation'
import { CssVar } from '../types/Theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { IconButton, Tabs, Tab, useTheme } from '@concrnt/ui'
import { MdArrowBack, MdHome, MdExplore, MdNotifications, MdContacts } from 'react-icons/md'

export const AppShell = () => {
    const isMobile = useIsMobile()
    return isMobile ? <MobileShell /> : <DesktopShell />
}

const DesktopShell = () => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100vw',
                height: '100dvh',
                boxSizing: 'border-box',
                backgroundColor: CssVar.backdropBackground,
                alignItems: 'center'
            }}
        >
            <PwaManager />
            <DomainOfflineBanner />
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    minHeight: 0,
                    maxWidth: '1280px',
                    width: '100%'
                }}
            >
                <aside
                    style={{
                        width: '200px',
                        margin: CssVar.space(2)
                    }}
                >
                    <Sidebar />
                </aside>
                <main
                    style={{
                        display: 'flex',
                        flex: 1,
                        overflow: 'hidden'
                    }}
                >
                    <div
                        style={{
                            flexGrow: '1',
                            margin: CssVar.space(2),
                            display: 'flex',
                            flexFlow: 'column',
                            borderRadius: CssVar.round(2),
                            overflow: 'hidden',
                            background: 'none',
                            boxShadow:
                                '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)'
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
            <DomainOfflineBanner />
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
                                borderTop: theme.variant === 'classic' ? `1px solid ${CssVar.divider}` : undefined
                            }}
                        >
                            {TABS.map((tab) => (
                                <Tab
                                    key={tab.path}
                                    groupId="bottom-tabs"
                                    selected={location.pathname === tab.path}
                                    onClick={() => navigate(tab.path)}
                                    style={{
                                        color: CssVar.backdropText
                                    }}
                                >
                                    {tab.icon}
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
