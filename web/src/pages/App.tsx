import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { CssVar } from '../types/Theme'
import { StackLayout } from '../layouts/Stack'

export const AppShell = () => {
    return (
        <div
            style={{
                display: 'flex',
                width: '100vw',
                height: '100dvh',
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
                    height: '100%'
                }}
            >
                <aside
                    style={{
                        width: '250px',
                        flex: '0 0 250px',
                        height: '100%'
                    }}
                >
                    <Sidebar />
                </aside>
                <main
                    style={{
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        overflow: 'hidden'
                    }}
                >
                    <StackLayout>
                        <Outlet />
                    </StackLayout>
                </main>
            </div>
        </div>
    )
}

export const App = AppShell
