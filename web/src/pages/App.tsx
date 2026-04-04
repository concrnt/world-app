import { Outlet } from "react-router-dom"
import { Sidebar } from "../components/Sidebar"

export const App = () => {
    return <div
        style={{
            display: 'flex',
            width: '100vw',
            flexDirection: 'column',
            alignItems: 'center',
        }}
    >
        <div
            style={{
                display: 'flex',
                flex: 1,
                maxWidth: '850px',
                width: '100%',
                height: '100%',
            }}
        >
            <div
                style={{
                    width: "250px",
                }}
            >
                <Sidebar />
            </div>
            <div
                style={{
                    flex: 1,
                    overflow: 'hidden',
                }}
            >
                <Outlet />
            </div>
        </div>
    </div>
}

