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
 * 指定されたクロップ領域で画像を切り抜き、outputSize x outputSize の正方形 PNG File を返す
 */
export const cropImage = async (imageSrc: string, pixelCrop: PixelCrop, outputSize: number = 512): Promise<File> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    canvas.width = outputSize
    canvas.height = outputSize
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        throw new Error('Failed to get canvas context')
    }

    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outputSize, outputSize)

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Failed to create blob'))
                return
            }
            resolve(new File([blob], 'avatar.png', { type: 'image/png' }))
        }, 'image/png')
    })
}
