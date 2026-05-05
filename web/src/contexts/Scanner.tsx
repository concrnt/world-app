import { Button, CssVar, Text, TextField } from '@concrnt/ui'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

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
    const [resolver, setResolver] = useState<((value: string | null) => void) | null>(null)
    const [draft, setDraft] = useState('')

    const scan = useCallback(async () => {
        setDraft('')
        return new Promise<string | null>((resolve) => {
            setResolver(() => resolve)
        })
    }, [])

    const close = (value: string | null) => {
        resolver?.(value)
        setResolver(null)
        setDraft('')
    }

    const value = useMemo(() => ({ scan }), [scan])

    return (
        <ScannerContext.Provider value={value}>
            {props.children}
            {resolver && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: CssVar.space(2),
                        backgroundColor: 'rgba(0, 0, 0, 0.45)'
                    }}
                >
                    <div
                        style={{
                            width: 'min(420px, 100%)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2),
                            padding: CssVar.space(3),
                            borderRadius: CssVar.round(2),
                            color: CssVar.contentText,
                            backgroundColor: CssVar.contentBackground
                        }}
                    >
                        <Text variant="h3">QRコードの内容を入力</Text>
                        <Text>このブラウザではカメラスキャンの代わりに、QRコードの文字列を貼り付けます。</Text>
                        <TextField value={draft} onChange={(e) => setDraft(e.target.value)} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1) }}>
                            <Button variant="text" onClick={() => close(null)}>
                                キャンセル
                            </Button>
                            <Button disabled={!draft} onClick={() => close(draft)}>
                                決定
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </ScannerContext.Provider>
    )
}

export const useScanner = () => {
    return useContext(ScannerContext)
}
