import { encode } from 'blurhash'

const RESIZE = 32
const COMPONENT_X = 4
const COMPONENT_Y = 3

/**
 * 画像ファイルからblurhashを計算する。
 * 画像以外のファイルが渡された場合はundefinedを返す。
 */
export const computeBlurhash = async (file: File): Promise<string | undefined> => {
    if (!file.type.startsWith('image/')) return undefined

    const bitmap = await createImageBitmap(file)

    const aspect = bitmap.width / bitmap.height
    const width = aspect >= 1 ? RESIZE : Math.round(RESIZE * aspect)
    const height = aspect >= 1 ? Math.round(RESIZE / aspect) : RESIZE

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const imageData = ctx.getImageData(0, 0, width, height)
    return encode(imageData.data, width, height, COMPONENT_X, COMPONENT_Y)
}
