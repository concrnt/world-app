import { Outlet } from "react-router-dom"

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
                    backgroundColor: "red"
                }}
            >
                Sidebar
            </div>
            <div
                style={{
                    flex: 1,
                    backgroundColor: "green"
                }}
            >
                <Outlet />
            </div>
        </div>
    </div>
}

