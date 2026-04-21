import { useClient } from './contexts/Client'
import { WelcomeView } from './views/Welcome'
import { MainView } from './views/Main'
import { Button, CssVar } from '@concrnt/ui'
import { LoadingFull } from './components/LoadingFull'

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
                        <LoadingFull>
                            <Button
                                variant="outlined"
                                onClick={async () => {
                                    logout().then(() => {
                                        window.location.reload()
                                    })
                                }}
                                style={{
                                    color: CssVar.uiText,
                                    borderColor: CssVar.uiText,
                                    fontSize: '0.8rem'
                                }}
                            >
                                リセット
                            </Button>
                        </LoadingFull>
                    )
            })()}
        </div>
    )
}

export default App
