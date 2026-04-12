import { useClient } from './contexts/Client'
import { WelcomeView } from './views/Welcome'
import { MainView } from './views/Main'
import { Button, ConcrntLogo, CssVar, Text } from '@concrnt/ui'

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
                                height: '100dvh',
                                width: '100dvw',
                                backgroundColor: CssVar.uiBackground,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingTop: 'env(safe-area-inset-top)',
                                paddingBottom: 'env(safe-area-inset-bottom)'
                            }}
                        >
                            <ConcrntLogo
                                spinning
                                size="100px"
                                upperColor={CssVar.uiText}
                                lowerColor={CssVar.uiText}
                                frameColor={CssVar.uiText}
                            />
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 'calc(env(safe-area-inset-bottom) + 10px)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
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
                                <Text
                                    style={{
                                        color: CssVar.uiText,
                                        fontWeight: 600,
                                        fontSize: '22px'
                                    }}
                                >
                                    Concrnt
                                </Text>
                            </div>
                        </div>
                    )
            })()}
        </div>
    )
}

export default App
