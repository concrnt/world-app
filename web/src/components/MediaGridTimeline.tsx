import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { QueryTimelineReader } from '@concrnt/client'
import { Client, MediaMessageSchema } from '@concrnt/worldlib'
import { CssVar, Skeleton, Text } from '@concrnt/ui'
import { RenderError } from './message/RenderError'
import { ErrorBoundary } from 'react-error-boundary'
import { PullToRefresh } from './PullToRefresh'
import { Media, MediaTile } from './MediaGallery/main'
import { useMediaViewer } from '../contexts/MediaViewer'

// メディア投稿のクエリ結果をクライアント側で展開し、1メディア=1タイルの平坦な一覧として描画する。
// NotificationTimelineと同じく reader.body を iter カーソルで差分処理して積み上げる
interface GridItem {
    // 同一メッセージ内に同じURLが複数あっても一意になるよう index を付ける
    key: string
    media: Media
    messageURI: string
    // 元投稿内での位置と件数(ビューアの投稿内インジケーター用)
    postMediaIndex: number
    postMediaCount: number
}

interface Props extends ScrollViewProps {
    prefix: string
    query?: any
    batchSize?: number
    header?: React.ReactNode
}

// 1投稿あたり数枚しか出ないため、投稿単位の16件より多めに取って fill 判定の周回を減らす
const DEFAULT_BATCH_SIZE = 32

// タイルの最小幅(モバイル幅で3列程度になる値)と、デスクトップでの最大列数
const TILE_MIN_WIDTH = '110px'
const MAX_COLUMNS = 6
const GRID_GAP = CssVar.space(0.5)

// 画面が埋まっていないときの追い読み判定の猶予(ms)。初期値から判定ごとに倍増し上限で頭打ち
const FILL_DELAY_MIN = 100
const FILL_DELAY_MAX = 1000

export const MediaGridTimeline = (props: Props) => {
    // 取得対象が変わったら中身ごと作り直す(呼び出し側がquery参照を作り直しても、内容が同じなら維持)
    return (
        <MediaGridTimelineInner
            key={props.prefix + '|' + JSON.stringify(props.query ?? {}) + '|' + (props.batchSize ?? '')}
            {...props}
        />
    )
}

const MediaGridTimelineInner = (props: Props) => {
    const { client } = useClient()
    const { t } = useTranslation('', { keyPrefix: 'components.mediaGridTimeline' })
    const mediaViewer = useMediaViewer()
    // このインスタンスの取得対象は固定(変わったら外側でkeyごと作り直される)
    const [target] = useState(() => ({
        prefix: props.prefix,
        query: props.query ?? {},
        batchSize: props.batchSize ?? DEFAULT_BATCH_SIZE
    }))

    const loadingRef = useRef(true)
    const fillDelayRef = useRef(FILL_DELAY_MIN)
    const scrollPositionRef = useRef<number>(0)
    // 表示はitemsで行うので、readerの更新(onUpdate)は購読しない
    const readerRef = useRef<QueryTimelineReader | undefined>(undefined)
    // readerをどのClientで初期化したか。Activityのhidden→visible復帰やStrictModeでは
    // refを残したままeffectだけが再実行されるので、同じClientなら何もしない
    const initializedRef = useRef<Client | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [hasMoreData, setHasMoreData] = useState<boolean>(false)
    const [items, setItems] = useState<GridItem[]>([])
    // ビューアの getMedia から同期的に参照するため、state と同じ内容を常に持つ
    const itemsRef = useRef<GridItem[]>([])
    const hasMoreDataRef = useRef(false)
    // 進行中の追い読み。スクロールとビューアの loadMore が同時に来ても1回にまとめる
    const readMorePromiseRef = useRef<Promise<boolean> | null>(null)
    // PullToRefresh のインジケータ表示制御用
    const [isFetching, setIsFetching] = useState(false)

    // reader.body のうちどこまで展開済みかを保持するカーソル
    // init/reload で 0 リセット、readMore で積み上げる
    const iter = useRef(0)

    const collectMedias = useCallback(async (): Promise<GridItem[]> => {
        if (!readerRef.current) return []

        const newItems = readerRef.current.body.slice(iter.current, readerRef.current.body.length)
        iter.current = readerRef.current.body.length

        const resolved = await Promise.all(
            newItems.map(async (item) => {
                if (!item.href) return null
                const hint = item.source ? new URL(item.source).hostname : undefined
                return client.getMessage<MediaMessageSchema>(item.href, hint).catch(() => null)
            })
        )

        const result: GridItem[] = []
        for (const msg of resolved) {
            if (!msg) continue
            const medias = msg.value?.medias
            // schemaで絞り込み済みだが、壊れたdocumentは表示から落とす
            if (!Array.isArray(medias)) continue
            medias.forEach((media, index) => {
                result.push({
                    key: msg.uri + '#' + index,
                    media,
                    messageURI: msg.uri,
                    postMediaIndex: index,
                    postMediaCount: medias.length
                })
            })
        }
        return result
    }, [client])

    useEffect(() => {
        if (initializedRef.current === client) return
        // Client差し替えでは、取り直しが届くまで表示中のitemsを残す(届いたら丸ごと置き換える)
        const t = client.newQueryTimelineReader()
        readerRef.current = t
        initializedRef.current = client
        loadingRef.current = true

        t.init(target.prefix, target.query, target.batchSize)
            .then(async (hasMore) => {
                if (readerRef.current !== t) return
                hasMoreDataRef.current = hasMore
                setHasMoreData(hasMore)
                iter.current = 0
                const newItems = await collectMedias()
                if (readerRef.current !== t) return
                itemsRef.current = newItems
                setItems(newItems)
            })
            .catch((err) => {
                console.error('Failed to initialize media timeline:', err)
            })
            .finally(() => {
                if (readerRef.current !== t) return
                loadingRef.current = false
                setLoading(false)
            })
    }, [client, target, collectMedias])

    const scrollRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
    }))

    // PullToRefresh のリロード処理
    // reader.reload() で body を更新した後、iter を 0 に戻して再展開する
    const onRefresh = useCallback(async () => {
        if (!readerRef.current) return
        setIsFetching(true)
        try {
            iter.current = 0
            itemsRef.current = []
            setItems([])
            const hasMore = await readerRef.current.reload()
            hasMoreDataRef.current = hasMore
            setHasMoreData(hasMore)
            const newItems = await collectMedias()
            itemsRef.current = newItems
            setItems(newItems)
            // ユーザーにリフレッシュのフィードバックを見せるための短い待機
            await new Promise((resolve) => setTimeout(resolve, 500))
        } finally {
            setIsFetching(false)
        }
    }, [collectMedias])

    // 追い読み(スクロール末尾とビューアの「次へ」で共用)。続きがあり得るなら true を返す
    const loadMore = useCallback((): Promise<boolean> => {
        if (!readerRef.current || !hasMoreDataRef.current) return Promise.resolve(false)
        if (readMorePromiseRef.current) return readMorePromiseRef.current

        loadingRef.current = true
        setLoading(true)
        const promise = readerRef.current
            .readMore()
            .then((hasMore) => {
                hasMoreDataRef.current = hasMore
                setHasMoreData(hasMore)
                return collectMedias().then((newItems) => {
                    if (newItems.length > 0) {
                        itemsRef.current = [...itemsRef.current, ...newItems]
                        setItems(itemsRef.current)
                    }
                    return hasMore
                })
            })
            .catch((e) => {
                console.error('Failed to read more', e)
                return false
            })
            .finally(() => {
                readMorePromiseRef.current = null
                loadingRef.current = false
                setLoading(false)
            })
        readMorePromiseRef.current = promise
        return promise
    }, [collectMedias])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const handleScroll = () => {
            // PullToRefresh用にスクロール位置を記録
            scrollPositionRef.current = el.scrollTop

            if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
                if (loadingRef.current) return
                if (!hasMoreData) return
                void loadMore()
            }
        }

        el.addEventListener('scroll', handleScroll)
        // コンテンツがコンテナを満たしていないとscrollイベントが発生せず次ページが永遠に読まれないため、
        // 読み込みが落ち着いたら一度だけ手動で判定する(不足していればreadMore→loadingが戻って再判定)。
        // 猶予は短く始めて判定でreadMoreが走るたびに倍にし(上限あり)、埋まった/読み切ったら初期値に戻す
        const fill = setTimeout(() => {
            if (loadingRef.current) return
            handleScroll()
            fillDelayRef.current = loadingRef.current
                ? Math.min(fillDelayRef.current * 2, FILL_DELAY_MAX)
                : FILL_DELAY_MIN
        }, fillDelayRef.current)
        return () => {
            el.removeEventListener('scroll', handleScroll)
            clearTimeout(fill)
        }
    }, [hasMoreData, loading, loadMore])

    return (
        <PullToRefresh positionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    // 読み込み後にスクロールバーが出て内容幅が変わらないよう、最初からガターを確保しておく
                    scrollbarGutter: 'stable',
                    // iOS の慣性スクロール跳ね返りを抑制して PullToRefresh との干渉を防ぐ
                    overscrollBehaviorY: 'none'
                }}
                ref={scrollRef}
            >
                {props.header}
                <div
                    style={{
                        display: 'grid',
                        // 列の最小幅は TILE_MIN_WIDTH と「MAX_COLUMNS 列でちょうど収まる幅」の大きい方。
                        // モバイル幅では最小幅が効いて3列前後、幅が広がっても MAX_COLUMNS を超えない
                        gridTemplateColumns: `repeat(auto-fill, minmax(max(${TILE_MIN_WIDTH}, calc((100% - ${MAX_COLUMNS - 1} * ${GRID_GAP}) / ${MAX_COLUMNS})), 1fr))`,
                        gap: GRID_GAP,
                        padding: `0 ${CssVar.space(2)}`
                    }}
                >
                    {items.map((item, index) => (
                        <ErrorBoundary key={item.key} FallbackComponent={RenderError}>
                            <div
                                style={{
                                    contentVisibility: 'auto',
                                    containIntrinsicSize: `auto ${TILE_MIN_WIDTH}`
                                }}
                            >
                                <MediaTile
                                    media={item.media}
                                    objectFit="cover"
                                    style={{ aspectRatio: '1', borderRadius: 0 }}
                                    onClick={() => {
                                        // 件数固定の配列ではなくコールバックで渡す: ビューア内の「次へ」で
                                        // 読み込み済み末尾に達したら追い読みして続きを表示できる
                                        mediaViewer.openSource(
                                            {
                                                getMedia: (i) => {
                                                    const item = itemsRef.current[i]
                                                    return item
                                                        ? {
                                                              ...item.media,
                                                              messageURI: item.messageURI,
                                                              postMediaIndex: item.postMediaIndex,
                                                              postMediaCount: item.postMediaCount
                                                          }
                                                        : null
                                                },
                                                loadMore
                                            },
                                            index
                                        )
                                    }}
                                />
                            </div>
                        </ErrorBoundary>
                    ))}
                    {loading &&
                        Array.from({ length: 6 }, (_, i) => (
                            <Skeleton key={'skeleton-' + i} style={{ aspectRatio: '1' }} />
                        ))}
                </div>
                {!loading && !hasMoreData && items.length === 0 && (
                    <Text style={{ opacity: 0.65, textAlign: 'center', padding: CssVar.space(4) }}>{t('noMedia')}</Text>
                )}
                {!hasMoreData && (
                    <div
                        style={{
                            padding: '8px',
                            fontSize: '12px',
                            color: '#888',
                            width: '100%',
                            height: '100px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        -- End of Timeline --
                    </div>
                )}
            </div>
        </PullToRefresh>
    )
}
