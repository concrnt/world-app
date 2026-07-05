import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { DomainOfflineBanner } from '../components/DomainOfflineBanner'
import { CssVar } from '../types/Theme'

export const AppShell = () => {
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

export const App = AppShell
