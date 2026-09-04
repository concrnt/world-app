export class CachedPromise<T> {
    private promise: Promise<T> | null = null
    private subscriptions: Array<() => void> = []
    private settled?: { value: T }

    constructor(
        private executor: (fresh?: boolean) => Promise<T>,
        private isEqual?: (a: T, b: T) => boolean
    ) {}

    value(): Promise<T> {
        if (!this.promise) {
            const promise = this.executor()
            promise.then(
                (value) => {
                    if (this.promise === promise) {
                        this.settled = { value }
                        // current で非サスペンド読みしている購読者へ解決を知らせる。
                        // (use()経由の購読者は同じpromiseを読み直すだけなので無害)
                        for (const callback of this.subscriptions) {
                            callback()
                        }
                    }
                },
                () => {
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
                }
            )
            this.promise = promise
        }
        return this.promise
    }

    // 解決済みの値をサスペンドせずに読む(未解決ならundefined)。
    // タブバー等、Suspense境界を置きたくない場所向け。取得の起動はvalue()で行うこと
    get current(): T | undefined {
        return this.settled?.value
    }

    // 最新値で置き換えて購読者へ再通知する。isEqualで前回解決値と同一なら何もしない
    // (アプリ復帰のたびに購読コンポーネントが再マウント・再フェッチされるのを防ぐ)
    push(value: T): void {
        if (this.promise && this.settled && this.isEqual?.(this.settled.value, value)) {
            return
        }
        const promise = Promise.resolve(value)
        // Reactのuse()はstatus付きthenableを同期的に読み取れる。
        // これが無いとsnapshot差し替えで一瞬suspendしてSuspenseフォールバックがちらつく
        Object.assign(promise, { status: 'fulfilled', value })
        this.promise = promise
        this.settled = { value }
        for (const callback of this.subscriptions) {
            callback()
        }
    }

    // executorをfresh=trueで再実行し、成功時のみpushする(キャッシュ即表示→裏で更新)
    async refresh(): Promise<void> {
        try {
            this.push(await this.executor(true))
        } catch {
            // オフライン等では既存値を維持する。未取得なら次のvalue()が通常経路で再試行する
        }
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
