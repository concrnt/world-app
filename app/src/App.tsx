import { useClient } from './contexts/Client'
import { WelcomeView } from './views/Welcome'
import { MainView } from './views/Main'
import { useCallback } from 'react'

import { ThemeProvider } from './contexts/Theme'
import { PreferenceProvider } from './contexts/Preference'
import { SelectProvider } from './contexts/Select'
import { DrawerProvider } from './contexts/Drawer'
import { OverlayProvider } from './contexts/Overlay'
import { ComposerProvider } from './contexts/Composer'

function App() {
    const client = useClient()

    const providers = useCallback((children: React.ReactNode) => {
        return (
            <PreferenceProvider>
                <ThemeProvider>
                    <DrawerProvider>
                        <SelectProvider>
                            <ComposerProvider>
                                <OverlayProvider>{children}</OverlayProvider>
                            </ComposerProvider>
                        </SelectProvider>
                    </DrawerProvider>
                </ThemeProvider>
            </PreferenceProvider>
        )
    }, [])

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
                if (client.uninitialized === true) return providers(<WelcomeView />)
                else if (client.client) return providers(<MainView />)
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
