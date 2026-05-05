const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.crossOrigin = 'anonymous'
        image.src = url
    })

interface PixelCrop {
    x: number
    y: number
    width: number
    height: number
}

/**
 * 指定されたクロップ領域で画像を切り抜き、outputWidth x outputHeight の PNG File を返す
 * outputHeight を省略すると outputWidth x outputWidth の正方形になる
 */
export const cropImage = async (
    imageSrc: string,
    pixelCrop: PixelCrop,
    outputWidth: number = 512,
    outputHeight?: number
): Promise<File> => {
    const h = outputHeight ?? outputWidth
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = h
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        throw new Error('Failed to get canvas context')
    }

    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outputWidth, h)

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Failed to create blob'))
                return
            }
            resolve(new File([blob], 'cropped.png', { type: 'image/png' }))
        }, 'image/png')
    })
}
