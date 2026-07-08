interface PixelCrop {
    x: number
    y: number
    width: number
    height: number
}

/** 入力の MIME から、canvas で再エンコード可能な出力形式と拡張子を決める */
const resolveOutput = (inputType: string): { mime: string; ext: string; lossy: boolean } => {
    switch (inputType) {
        case 'image/jpeg':
            return { mime: 'image/jpeg', ext: 'jpg', lossy: true }
        case 'image/webp':
            return { mime: 'image/webp', ext: 'webp', lossy: true }
        case 'image/png':
            return { mime: 'image/png', ext: 'png', lossy: false }
        default:
            // heic/gif/avif/bmp/svg 等 canvas で再エンコードできない型は可逆な PNG に退避
            return { mime: 'image/png', ext: 'png', lossy: false }
    }
}

const canvasToFile = (canvas: HTMLCanvasElement, mime: string, ext: string, quality: number): Promise<File> =>
    new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Failed to create blob'))
                    return
                }
                resolve(new File([blob], `cropped.${ext}`, { type: mime }))
            },
            mime,
            quality
        )
    })

/** createImageBitmap の resize オプションが使えない環境向けフォールバック */
const cropWithImageElement = async (
    source: Blob,
    pixelCrop: PixelCrop,
    outputWidth: number,
    outputHeight: number,
    mime: string,
    ext: string,
    quality: number
): Promise<File> => {
    const url = URL.createObjectURL(source)
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.addEventListener('load', () => resolve(img))
            img.addEventListener('error', (e) => reject(e))
            img.src = url
        })

        const canvas = document.createElement('canvas')
        canvas.width = outputWidth
        canvas.height = outputHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            outputWidth,
            outputHeight
        )

        return await canvasToFile(canvas, mime, ext, quality)
    } finally {
        URL.revokeObjectURL(url)
    }
}

/**
 * 指定されたクロップ領域で画像を切り抜き、outputWidth x outputHeight の File を返す。
 * outputHeight を省略すると outputWidth x outputWidth の正方形になる。
 * 出力形式は入力ファイルの形式に合わせる（PNG は可逆維持、JPEG/WebP は quality を適用）。
 *
 * createImageBitmap のソース矩形指定 + resize によって、デコード段階で
 * 「切り抜き + 高品質縮小」をネイティブ・オフメインスレッドで一括実行し高速化する。
 */
export const cropImage = async (
    source: Blob,
    pixelCrop: PixelCrop,
    outputWidth: number = 512,
    outputHeight?: number,
    quality: number = 0.92
): Promise<File> => {
    const h = outputHeight ?? outputWidth
    const { mime, ext } = resolveOutput(source.type)

    const sx = Math.round(pixelCrop.x)
    const sy = Math.round(pixelCrop.y)
    const sw = Math.round(pixelCrop.width)
    const sh = Math.round(pixelCrop.height)

    // 高速パス: createImageBitmap で切り抜き + 高品質縮小を一括実行
    try {
        const bitmap = await createImageBitmap(source, sx, sy, sw, sh, {
            resizeWidth: outputWidth,
            resizeHeight: h,
            resizeQuality: 'high'
        })
        try {
            const canvas = document.createElement('canvas')
            canvas.width = outputWidth
            canvas.height = h
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Failed to get canvas context')
            ctx.drawImage(bitmap, 0, 0)
            return await canvasToFile(canvas, mime, ext, quality)
        } finally {
            bitmap.close()
        }
    } catch {
        // 古い WKWebView 等で resize オプション未対応の場合は Image 経路へ退避
        return await cropWithImageElement(source, pixelCrop, outputWidth, h, mime, ext, quality)
    }
}
