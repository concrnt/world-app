import { AuthProvider } from "./interface";
import { type JwtPayload } from "../crypto";

export class GuestAuthProvider implements AuthProvider {

    defaultHost = ''
    
    constructor(defaultHost: string) {
        this.defaultHost = defaultHost
    }

    async getHeaders(_domain: string) {
        return {};
    }

    getAuthToken(_domain: string): string {
        throw new Error("Method not implemented.");
    }

    getCCID(): never {
        throw new Error("Method not implemented.");
    }

    getCKID(): never {
        throw new Error("Method not implemented.");
    }

    getPassport(): never {
        throw new Error("Method not implemented.");
    }

    getHost(): string {
        return this.defaultHost
    }

    sign(_data: string): never {
        throw new Error("Method not implemented.");
    }

    issueJWT(_claims: JwtPayload): never {
        throw new Error("Method not implemented.");
    }
}
