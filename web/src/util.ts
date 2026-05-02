
export const string2Uint8Array = (str: string): Uint8Array => {
    const encoder = new TextEncoder()
    return encoder.encode(str)
}

