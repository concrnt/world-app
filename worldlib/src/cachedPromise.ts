export class CachedPromise<T> {
    private promise: Promise<T> | null = null
    private subscriptions: Array<() => void> = []

    constructor(private executor: () => Promise<T>) {}

    value(): Promise<T> {
        if (!this.promise) {
            const promise = this.executor()
            promise.catch(() => {
                // 失敗はキャッシュしない(次のvalue()で再実行できるようにする)
                if (this.promise === promise) {
                    this.promise = null
                }
            })
            this.promise = promise
        }
        return this.promise
    }

    reload() {
        this.promise = null
        this.value()
        for (const callback of this.subscriptions) {
            callback()
        }
    }

    subscribe(callback: () => void) {
        this.subscriptions.push(callback)
    }

    unsubscribe(callback: () => void) {
        this.subscriptions = this.subscriptions.filter((sub) => sub !== callback)
    }
}
