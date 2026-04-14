import { useState, useCallback } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { CssVar } from '../types/Theme'
import { cropImage } from '../utils/cropImage'

interface Props {
    imageSrc: string
    onComplete: (croppedFile: File) => void
    onCancel: () => void
    /** 出力画像の一辺のサイズ (px)。デフォルト 512 */
    outputSize?: number
}

export const ImageCropper = (props: Props) => {
    const { imageSrc, onComplete, onCancel, outputSize = 512 } = props

    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [processing, setProcessing] = useState(false)

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleConfirm = useCallback(async () => {
        if (!croppedAreaPixels) return
        setProcessing(true)
        try {
            const croppedFile = await cropImage(imageSrc, croppedAreaPixels, outputSize)
            onComplete(croppedFile)
        } catch (e) {
            console.error('Failed to crop image:', e)
        } finally {
            setProcessing(false)
        }
    }, [croppedAreaPixels, imageSrc, onComplete, outputSize])

    return (
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
                    aspect={1}
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
                    onClick={onCancel}
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
    )
}
