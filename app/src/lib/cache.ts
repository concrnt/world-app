import { IndexedDBKVS } from '@concrnt/client'

// リソースキャッシュはアカウント(ccid)ごとに別のDBを持つ。
// アカウント切り替え後もキャッシュが温存され、アカウント間のプライベートな
// コンテンツがキャッシュ越しに混ざることも防ぐ。
const DB_PREFIX = 'concrnt-'

export const getResourceCache = (ccid: string): IndexedDBKVS => {
    return new IndexedDBKVS(`${DB_PREFIX}${ccid}`, 'cache')
}

export const deleteResourceCache = async (ccid: string): Promise<void> => {
    await deleteDatabase(`${DB_PREFIX}${ccid}`)
}

export const deleteAllResourceCaches = async (): Promise<void> => {
    const databases = await indexedDB.databases()
    await Promise.all(
        databases.filter((db) => db.name?.startsWith(DB_PREFIX)).map((db) => deleteDatabase(db.name!).catch(() => {}))
    )
}

const deleteDatabase = (name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => resolve() // 開いている接続があっても削除は予約されるので進める
    })
}
