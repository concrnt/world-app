export interface AuthProvider {
    getCCID: () => string
    getCKID: () => string | undefined

    signMaster(data: string): Promise<string>
    signSub(data: string): Promise<string>
}
