import { JwtPayload } from "../crypto";

export interface AuthProvider {
    getCCID: () => string;
    getCKID: () => string | undefined;
    getHeaders: (domain: string) => Promise<Record<string, string>>;
    getAuthToken: (domain: string) => string;
    getPassport: () => Promise<string>;
    getHost: () => string;

    sign(data: string): string;
    issueJWT: (claims: JwtPayload) => string;
}


