import { Client, Timeline } from '@concrnt/worldlib'
import { fetchSearch } from '../components/SearchExplorer'

// 投稿先候補(TimelinePicker)の検索プロバイダー。
// knownCommunities(自分のリストに登録済み)と crawler(グローバル検索)を同じ形で扱い、合成して使う。
// どのプロバイダーも React のサスペンドを起こさない(スナップショットの同期読み+コールバック通知)。

export interface SearchHit {
    uri: string
    name: string
    description?: string
    // knownCommunities に含まれる(候補行の末尾にチェックマークを出す)
    known: boolean
    // 解決hint(crawler の sourceServer)。client.getTimeline(uri, hint) に渡す
    hint?: string
    // 最近手動で選択した候補(RecentSearchProvider 由来。候補行の末尾に履歴アイコンを出す)
    recent?: boolean
}

export interface SearchProvider {
    // query==='' は「既定一覧」(known は全件、crawler は何も出さない)。
    // emit はこのプロバイダーの「その時点の全件」を受け取り、signal が abort されるまで何度でも呼ばれうる
    // (search() 内で同期的に・スナップショット到着時・ネットワーク到着時)。失敗は emit しないだけで throw しない
    search(query: string, signal: AbortSignal, emit: (hits: SearchHit[]) => void): void
    // この uri を「登録済み」として知っているか(同期)。合成時に、他プロバイダーのヒットへチェックを付けるのに使う
    // (known 側の名前がクエリに一致しなくても、crawler 側が同じ uri を返せばチェックが付く)
    knows?(uri: string): boolean
    // ユーザーが候補を手動で選んだことを通知する。履歴を持つプロバイダーだけが実装し、他は無視する
    remember?(hit: SearchHit): void
}

const matches = (name: string, query: string): boolean => {
    if (query === '') return true
    return name.toLowerCase().includes(query.toLowerCase())
}

// client.knownCommunities のスナップショット(CachedPromise.current)を読む。
// 未解決なら取得だけ蹴って空のまま返し、解決/更新は CachedPromise の購読で再 emit する
export class KnownCommunitySearchProvider implements SearchProvider {
    constructor(
        private client: Client,
        private filter?: (timeline: Timeline) => boolean
    ) {}

    search(query: string, signal: AbortSignal, emit: (hits: SearchHit[]) => void): void {
        const read = (): void => {
            if (signal.aborted) return
            const current = this.client.knownCommunities.current
            if (!current) {
                void this.client.knownCommunities.value().catch(() => {})
                return
            }
            emit(
                current
                    .filter((tl) => this.filter?.(tl) ?? true)
                    .map((tl) => ({
                        uri: tl.uri,
                        name: tl.name || tl.shortname || tl.uri,
                        description: tl.description,
                        known: true
                    }))
                    .filter((hit) => matches(hit.name, query))
            )
        }
        this.client.knownCommunities.subscribe(read)
        signal.addEventListener('abort', () => this.client.knownCommunities.unsubscribe(read), { once: true })
        read()
    }

    knows(uri: string): boolean {
        return (
            this.client.knownCommunities.current?.some((tl) => tl.uri === uri && (this.filter?.(tl) ?? true)) ?? false
        )
    }
}

// 固定候補(ActivityPub/Bluesky 設定の自分のinbox行など)
export class StaticSearchProvider implements SearchProvider {
    constructor(private hits: SearchHit[]) {}

    search(query: string, _signal: AbortSignal, emit: (hits: SearchHit[]) => void): void {
        emit(this.hits.filter((hit) => matches(hit.name, query)))
    }
}

// 最近手動で選択した候補。クエリが空の時だけ、選んだ順(新しい順)に出す(emoji picker の recent と同じ発想)。
// name/hint を一緒に保存しているので、リスト未登録の候補でも再表示とchipのラベル解決にネットワークが要らない
const RECENT_STORAGE_KEY = 'timelinePicker:recent'
const RECENT_LIMIT = 10

type RecentEntry = Pick<SearchHit, 'uri' | 'name' | 'description' | 'hint'>

export class RecentSearchProvider implements SearchProvider {
    private listeners = new Set<() => void>()

    private load(): RecentEntry[] {
        try {
            const raw = localStorage.getItem(RECENT_STORAGE_KEY)
            const parsed: unknown = raw ? JSON.parse(raw) : []
            if (!Array.isArray(parsed)) return []
            return parsed.filter(
                (entry): entry is RecentEntry =>
                    typeof entry === 'object' &&
                    entry !== null &&
                    typeof entry.uri === 'string' &&
                    typeof entry.name === 'string'
            )
        } catch {
            return []
        }
    }

    search(query: string, signal: AbortSignal, emit: (hits: SearchHit[]) => void): void {
        if (query !== '') return
        const read = (): void => {
            if (signal.aborted) return
            emit(this.load().map((entry) => ({ ...entry, known: false, recent: true })))
        }
        this.listeners.add(read)
        signal.addEventListener('abort', () => this.listeners.delete(read), { once: true })
        read()
    }

    remember(hit: SearchHit): void {
        const entry: RecentEntry = { uri: hit.uri, name: hit.name, description: hit.description, hint: hit.hint }
        const next = [entry, ...this.load().filter((e) => e.uri !== hit.uri)].slice(0, RECENT_LIMIT)
        try {
            localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
        } catch {
            // ストレージが使えない環境では履歴を諦めるだけで、選択自体は妨げない
        }
        // 候補一覧を開いたまま(クエリ空のまま)選んだ場合も、次に開いた時を待たずに並びを更新する
        for (const listener of this.listeners) listener()
    }
}

// crawler のコミュニティ検索(explorer と同じ)。mainnet かつオンラインの時だけ使い、失敗は無視する。
// デバウンスはここに閉じ込める(picker 側に置くと known の結果まで遅れる)
const CRAWLER_DEBOUNCE_MS = 300
const CRAWLER_LIMIT = 20

export class CrawlerSearchProvider implements SearchProvider {
    constructor(private client: Client) {}

    private available(): boolean {
        // server は起動時の仮値(layer '')から後で差し替わるので毎回評価する
        return this.client.server.layer === 'concrnt-mainnet' && navigator.onLine !== false
    }

    search(query: string, signal: AbortSignal, emit: (hits: SearchHit[]) => void): void {
        if (query.trim() === '' || !this.available()) return
        const timer = setTimeout(() => {
            void fetchSearch('communities', { q: query, limit: CRAWLER_LIMIT }).then((res) => {
                if (signal.aborted || !res) return
                emit(
                    res.hits.map((hit) => ({
                        uri: hit.cckv,
                        name: hit.name,
                        description: hit.description,
                        known: false,
                        hint: hit.sourceServer
                    }))
                )
            })
        }, CRAWLER_DEBOUNCE_MS)
        signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
    }
}

// 複数プロバイダーの合成。配列順がそのまま優先順(先頭のヒットが上に並ぶ)。
// 同じ uri は先勝ちで1件に畳み、どれかが known ならチェックを付ける
export class CompositeSearchProvider implements SearchProvider {
    constructor(private providers: SearchProvider[]) {}

    search(query: string, signal: AbortSignal, emit: (hits: SearchHit[]) => void): void {
        const parts: SearchHit[][] = this.providers.map(() => [])
        this.providers.forEach((provider, i) => {
            provider.search(query, signal, (hits) => {
                if (signal.aborted) return
                parts[i] = hits
                emit(this.merge(parts))
            })
        })
    }

    knows(uri: string): boolean {
        return this.providers.some((provider) => provider.knows?.(uri) ?? false)
    }

    remember(hit: SearchHit): void {
        for (const provider of this.providers) provider.remember?.(hit)
    }

    private merge(parts: SearchHit[][]): SearchHit[] {
        const merged = new Map<string, SearchHit>()
        for (const part of parts) {
            for (const hit of part) {
                if (merged.has(hit.uri)) continue
                merged.set(hit.uri, !hit.known && this.knows(hit.uri) ? { ...hit, known: true } : hit)
            }
        }
        return Array.from(merged.values())
    }
}
