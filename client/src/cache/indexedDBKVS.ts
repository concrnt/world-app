import { KVS, KVSEntry } from "./interface";

export class IndexedDBKVS implements KVS {
    private dbName: string;
    private storeName: string;

    constructor(dbName: string, storeName: string) {
        if (!indexedDB) {
            throw new Error("IndexedDB is not supported in this browser");
        }
        this.dbName = dbName;
        this.storeName = storeName;
    }

    private async initDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }

    async set<T>(key: string, value: T): Promise<void> {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ data: value, timestamp: Date.now() }, key);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    }

    async get<T>(key: string): Promise<KVSEntry<T> | null> {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = (event) => resolve((event.target as IDBRequest).result as KVSEntry<T> | null);
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    }

    async invalidate(key: string): Promise<void> {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    }
}
