export interface AuthProvider {
    getCCID: () => string
    getCKID: () => string | undefined

    canSignMaster: () => boolean
    canSignSub: () => boolean

    signMaster(data: string): Promise<string>
    signSub(data: string): Promise<[string, string]> // [signature, ckid]
}
