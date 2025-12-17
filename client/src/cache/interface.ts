
export interface KVS {
    set<T>(key: string, value: T): Promise<void>;
    get<T>(key: string): Promise<KVSEntry<T> | null>;
    invalidate(key: string): Promise<void>;
}

export interface KVSEntry<T> {
    data: T;
    timestamp: number;
}

