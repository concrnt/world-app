export class CachedPromise<T> {
    private promise: Promise<T> | null = null
    private subscriptions: Array<() => void> = []

    constructor(private executor: () => Promise<T>) {}

    value(): Promise<T> {
        if (!this.promise) {
            const promise = this.executor()
            promise.catch(() => {
                // 失敗はキャッシュしない(後のvalue()で再実行できるようにする)。
                // ただし即座にnullへ戻すと、useSyncExternalStore+use()で購読している
                // コンポーネントがreject直後の再レンダーのたびに新しいpromiseを受け取り、
                // 無限suspend/refetchループ(=画面フリーズ)になるため、猶予を置いて破棄する
                if (this.promise === promise) {
                    setTimeout(() => {
                        if (this.promise === promise) {
                            this.promise = null
                        }
                    }, 5000)
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
