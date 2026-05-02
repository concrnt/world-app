
export const string2Uint8Array = (str: string): BufferSource => {
    const encoder = new TextEncoder()
    return encoder.encode(str)
}

