import { Button } from '@concrnt/ui'
import {
    scan,
    cancel,
    Format,
    checkPermissions,
    requestPermissions,
    type PermissionState
} from '@tauri-apps/plugin-barcode-scanner'
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

const ensureCameraPermission = async (): Promise<boolean> => {
    try {
        let state: PermissionState = await checkPermissions()

        if (state !== 'granted') {
            state = await requestPermissions()
        }

        return state === 'granted'
    } catch (e) {
        console.error('Failed to check camera permission', e)
        return false
    }
}

export const ScannerProvider = (props: Props) => {
    const [mode, setMode] = useState<'idle' | 'scanning'>('idle')

    const scanWrapper = useCallback(async () => {
        const hasPermission = await ensureCameraPermission()
        if (!hasPermission) {
            console.error('Camera permission denied')
            return null
        }

        setMode('scanning')

        try {
            const result = await scan({
                windowed: true,
                formats: [Format.QRCode]
            })

            console.log('Scan result:', result)
            return result.content
        } catch (e) {
            console.error('Scan failed', e)
            return null
        } finally {
            setMode('idle')
        }
    }, [])

    const value = useMemo(
        () => ({
            scan: scanWrapper
        }),
        [scanWrapper]
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
