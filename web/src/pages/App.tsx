import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { CssVar } from '../types/Theme'

const GAP = CssVar.space(2)

export const AppShell = () => {
    return (
        <div
            style={{
                display: 'flex',
                width: '100vw',
                minHeight: '100dvh',
                paddingTop: GAP,
                boxSizing: 'border-box',
                backgroundColor: CssVar.backdropBackground,
                justifyContent: 'center'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    maxWidth: '1180px',
                    minWidth: 0,
                    width: '100%',
                    minHeight: `calc(100dvh - ${GAP})`,
                }}
            >
                <aside
                    style={{
                        width: '250px',
                        flex: '0 0 250px',
                        minHeight: `calc(100dvh - ${GAP})`,
                    }}
                >
                    <Sidebar />
                </aside>
                <main
                    style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: `calc(100dvh - ${GAP})`,
                        overflow: 'hidden'
                    }}
                >
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

export const App = AppShell
