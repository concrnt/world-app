import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { CssVar } from '../types/Theme'
import { cropImage } from '../utils/cropImage'

interface CropOptions {
    /** クロップ領域のアスペクト比。デフォルト 1 (正方形) */
    aspect?: number
    /** 出力画像の幅 (px)。デフォルト 512 */
    outputWidth?: number
    /** 出力画像の高さ (px)。省略時は outputWidth と同じ (正方形) */
    outputHeight?: number
}

interface ImageCropperState {
    /** クロッパーを開く。決定で File、キャンセルで null を返す */
    open: (imageSrc: string, options?: CropOptions) => Promise<File | null>
}

const ImageCropperContext = createContext<ImageCropperState>({
    open: () => Promise.resolve(null)
})

interface Props {
    children: React.ReactNode
}

export const ImageCropperProvider = (props: Props) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [options, setOptions] = useState<CropOptions>({})

    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [processing, setProcessing] = useState(false)

    // Promise の resolve を保持して、決定/キャンセル時に呼ぶ
    const resolverRef = useRef<((file: File | null) => void) | null>(null)

    const open = useCallback((src: string, opts?: CropOptions): Promise<File | null> => {
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCroppedAreaPixels(null)
        setProcessing(false)
        setImageSrc(src)
        setOptions(opts ?? {})

        return new Promise<File | null>((resolve) => {
            resolverRef.current = resolve
        })
    }, [])

    const handleConfirm = useCallback(async () => {
        if (!croppedAreaPixels || !imageSrc) return
        setProcessing(true)
        try {
            const croppedFile = await cropImage(
                imageSrc,
                croppedAreaPixels,
                options.outputWidth ?? 512,
                options.outputHeight
            )
            resolverRef.current?.(croppedFile)
        } catch (e) {
            console.error('Failed to crop image:', e)
            resolverRef.current?.(null)
        } finally {
            resolverRef.current = null
            setImageSrc(null)
            setProcessing(false)
        }
    }, [croppedAreaPixels, imageSrc, options])

    const handleCancel = useCallback(() => {
        resolverRef.current?.(null)
        resolverRef.current = null
        setImageSrc(null)
    }, [])

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const value = useMemo(() => ({ open }), [open])

    return (
        <ImageCropperContext.Provider value={value}>
            {props.children}

            {imageSrc && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100dvh',
                        backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        zIndex: 10000,
                        display: 'flex',
                        flexDirection: 'column',
                        touchAction: 'none'
                    }}
                >
                    {/* クロッパー領域 */}
                    <div
                        style={{
                            position: 'relative',
                            flex: 1,
                            marginTop: 'env(safe-area-inset-top)'
                        }}
                    >
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={options.aspect ?? 1}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            cropShape="rect"
                            showGrid={false}
                            style={{
                                cropAreaStyle: {
                                    borderRadius: '8px'
                                }
                            }}
                        />
                    </div>

                    {/* 下部コントロール */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: `${CssVar.space(4)} ${CssVar.space(6)}`,
                            paddingBottom: `max(${CssVar.space(4)}, env(safe-area-inset-bottom))`
                        }}
                    >
                        <button
                            onClick={handleCancel}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                fontSize: '16px',
                                cursor: 'pointer',
                                padding: `${CssVar.space(2)} ${CssVar.space(4)}`
                            }}
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={processing}
                            style={{
                                background: 'white',
                                border: 'none',
                                color: 'black',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: processing ? 'default' : 'pointer',
                                padding: `${CssVar.space(2)} ${CssVar.space(4)}`,
                                borderRadius: CssVar.round(1),
                                opacity: processing ? 0.5 : 1
                            }}
                        >
                            {processing ? '処理中...' : '決定'}
                        </button>
                    </div>
                </div>
            )}
        </ImageCropperContext.Provider>
    )
}

export const useImageCropper = (): ImageCropperState => {
    return useContext(ImageCropperContext)
}
