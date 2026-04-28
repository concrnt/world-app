export class CachedPromise<T> {
    private promise: Promise<T> | null = null
    private subscriptions: Array<() => void> = []

    constructor(private executor: () => Promise<T>) {}

    value(): Promise<T> {
        if (!this.promise) {
            this.promise = this.executor()
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
