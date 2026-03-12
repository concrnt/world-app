import { useClient } from './contexts/Client'
import { WelcomeView } from './views/Welcome'
import { MainView } from './views/Main'

function App() {
    const { client, logout } = useClient()

    console.log('client', client)

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {(() => {
                if (client === null) return <WelcomeView />
                else if (client) return <MainView />
                else
                    return (
                        <div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            Loading Client...
                            <button
                                onClick={async () => {
                                    logout().then(() => {
                                        window.location.reload()
                                    })
                                }}
                            >
                                RESET
                            </button>
                        </div>
                    )
            })()}
        </div>
    )
}

export default App
