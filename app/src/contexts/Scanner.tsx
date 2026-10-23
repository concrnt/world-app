import {
    scan,
    cancel,
    Format,
    checkPermissions,
    requestPermissions,
    type PermissionState
} from '@tauri-apps/plugin-barcode-scanner'
import { Activity, createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdClose } from 'react-icons/md'
import { useBackHandler } from './BackHandler'

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

// 読み取り枠の一辺。画面幅の 7 割、ただし大きな画面では上限を設ける
const VIEWFINDER_SIZE = 'min(70vw, 320px)'

// 読み取り枠の四隅のマーク。border の向きだけが違う
const corner = (vertical: 'top' | 'bottom', horizontal: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    [vertical]: '-3px',
    [horizontal]: '-3px',
    width: '28px',
    height: '28px',
    borderStyle: 'solid',
    borderColor: 'white',
    borderWidth: 0,
    [`border${vertical === 'top' ? 'Top' : 'Bottom'}Width`]: '4px',
    [`border${horizontal === 'left' ? 'Left' : 'Right'}Width`]: '4px',
    [`border${vertical === 'top' ? 'Top' : 'Bottom'}${horizontal === 'left' ? 'Left' : 'Right'}Radius`]: '12px'
})

export const ScannerProvider = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.scanner' })
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

    const close = useCallback(() => {
        cancel().then(() => {
            setMode('idle')
        })
    }, [])

    // Android の戻るボタン / スワイプバックでもスキャンをやめる
    useBackHandler(() => {
        close()
        return true
    }, mode === 'scanning')

    const value = useMemo(
        () => ({
            scan: scanWrapper
        }),
        [scanWrapper]
    )

    return (
        <ScannerContext.Provider value={value}>
            {/* windowed スキャン中は WebView が透過になり、カメラ映像がページの下に映る。
                ページ側は読み取り枠だけを素通しにして、周囲を暗くする(枠の box-shadow で画面全体を塗る) */}
            {mode === 'scanning' && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        color: 'white',
                        overflow: 'hidden'
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '24px',
                            paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
                            paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)'
                        }}
                    >
                        <div
                            style={{
                                position: 'relative',
                                width: VIEWFINDER_SIZE,
                                height: VIEWFINDER_SIZE,
                                flexShrink: 0,
                                borderRadius: '16px',
                                boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.6)'
                            }}
                        >
                            <div style={corner('top', 'left')} />
                            <div style={corner('top', 'right')} />
                            <div style={corner('bottom', 'left')} />
                            <div style={corner('bottom', 'right')} />
                        </div>
                    </div>

                    <div
                        style={{
                            position: 'absolute',
                            top: 'max(12px, env(safe-area-inset-top))',
                            left: '12px',
                            right: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}
                    >
                        <button
                            title={t('close')}
                            aria-label={t('close')}
                            onClick={close}
                            style={{
                                background: 'rgba(255, 255, 255, 0.15)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white'
                            }}
                        >
                            <MdClose size={24} />
                        </button>
                        <span
                            style={{
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)'
                            }}
                        >
                            {t('title')}
                        </span>
                    </div>
                </div>
            )}
            <Activity mode={mode === 'scanning' ? 'hidden' : 'visible'}>{props.children}</Activity>
        </ScannerContext.Provider>
    )
}

export const useScanner = () => {
    return useContext(ScannerContext)
}
