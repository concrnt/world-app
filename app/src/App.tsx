import { useClient } from './contexts/Client'
import { WelcomeView } from './views/Welcome'
import { MainView } from './views/Main'

function App() {
    const client = useClient()

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
                if (client.uninitialized === true) return <WelcomeView />
                else if (client.client) return <MainView />
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
                                    client.logout().then(() => {
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
