declare module 'js-sha3' {
    interface Hasher {
        create(): HasherInstance
        update(data: string | ArrayBuffer | Uint8Array): HasherInstance
        hex(): string
        digest(): number[]
        array(): number[]
        arrayBuffer(): ArrayBuffer
    }

    interface HasherInstance {
        update(data: string | ArrayBuffer | Uint8Array): HasherInstance
        hex(): string
        digest(): number[]
        array(): number[]
        arrayBuffer(): ArrayBuffer
    }

    export const keccak_256: ((data: string | ArrayBuffer | Uint8Array) => string) & Hasher
}
