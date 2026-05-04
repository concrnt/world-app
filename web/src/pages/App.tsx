import { CssVar } from '@concrnt/ui'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'

export const App = () => {
    return (
        <div
            style={{
                minHeight: '100dvh',
                backgroundColor: CssVar.backdropBackground,
                color: CssVar.backdropText
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '1280px',
                    minHeight: '100dvh',
                    margin: '0 auto',
                    padding: CssVar.space(2),
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'stretch',
                    gap: CssVar.space(2),
                    boxSizing: 'border-box'
                }}
            >
                <div
                    style={{
                        flex: '0 1 260px',
                        minWidth: '220px',
                        maxWidth: '100%'
                    }}
                >
                    <Sidebar />
                </div>
                <div
                    style={{
                        flex: '1 1 720px',
                        minWidth: 0,
                        minHeight: `calc(100dvh - (${CssVar.space(2)} * 2))`,
                        display: 'flex'
                    }}
                >
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
