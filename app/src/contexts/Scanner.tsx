import { Button } from '@concrnt/ui'
import { scan, cancel, Format /*checkPermissions, requestPermissions */ } from '@tauri-apps/plugin-barcode-scanner'
import { Activity, createContext, useCallback, useContext, useMemo, useState } from 'react'

interface ScannerContextState {
    scan: () => Promise<string | null>
}

interface Props {
    children: React.ReactNode
}

const ScannerContext = createContext<ScannerContextState>({
    scan: () => Promise.resolve(null)
})

export const ScannerProvider = (props: Props) => {
    const [mode, setMode] = useState<'idle' | 'scanning'>('idle')

    const scanWrapper = useCallback(async () => {
        setMode('scanning')

        /*
        const ps = await checkPermissions()
        if (ps === 'denied') {
            const r = await requestPermissions()
            if (r !== 'granted') {
                console.error('Camera permission denied')
                setMode('idle')
                return null
            }
        }
        */

        const result = await scan({
            windowed: true,
            formats: [Format.QRCode]
        })

        console.log('Scan result:', result)

        return Promise.resolve(result.content)
    }, [])

    const value = useMemo(
        () => ({
            scan: scanWrapper
        }),
        [scan]
    )

    return (
        <ScannerContext.Provider value={value}>
            {mode === 'scanning' && (
                <Button
                    onClick={() => {
                        cancel().then(() => {
                            setMode('idle')
                        })
                    }}
                    style={{
                        position: 'absolute',
                        top: 'calc(10px + env(safe-area-inset-top))',
                        left: '10px'
                    }}
                >
                    Cancel
                </Button>
            )}
            <Activity mode={mode === 'scanning' ? 'hidden' : 'visible'}>{props.children}</Activity>
        </ScannerContext.Provider>
    )
}

export const useScanner = () => {
    return useContext(ScannerContext)
}
