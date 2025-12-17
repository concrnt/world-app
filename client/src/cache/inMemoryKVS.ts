import { KVS, KVSEntry } from "./interface";

export class InMemoryKVS implements KVS {
    private store: Map<string, any> = new Map();

    async set<T>(key: string, value: T): Promise<void> {
        this.store.set(key, { data: value, timestamp: Date.now() });
    }

    async get<T>(key: string): Promise<KVSEntry<T> | null> {
        return this.store.has(key) ? (this.store.get(key) as KVSEntry<T>) : null;
    }

    async invalidate(key: string): Promise<void> {
        this.store.delete(key);
    }
}
