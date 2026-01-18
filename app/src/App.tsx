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
            {client.uninitialized === true && providers(<WelcomeView />)}
            {client.client && providers(<MainView />)}
        </div>
    )
}

export default App
