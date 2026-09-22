import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollViewProps } from '../types/ScrollView'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { QueryTimelineReader } from '@concrnt/client'
import { MediaMessageSchema } from '@concrnt/worldlib'
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
    const { client } = useClient()
    const { t } = useTranslation('', { keyPrefix: 'components.mediaGridTimeline' })
    const mediaViewer = useMediaViewer()

    const loadingRef = useRef(true)
    const fillDelayRef = useRef(FILL_DELAY_MIN)
    const scrollPositionRef = useRef<number>(0)
    const [reader, update] = useRefWithUpdate<QueryTimelineReader | undefined>(undefined)
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

    const collectMedias = async (): Promise<GridItem[]> => {
        if (!reader.current || !client) return []

        const newItems = reader.current.body.slice(iter.current, reader.current.body.length)
        iter.current = reader.current.body.length

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
                result.push({ key: msg.uri + '#' + index, media, messageURI: msg.uri })
            })
        }
        return result
    }

    useEffect(() => {
        let isCancelled = false
        if (!client) return

        // 再アタッチパス: effectが再実行された場合でも、対象が同じなら
        // 既存readerと展開済み表示・iterカーソルをそのまま保持する(スクロール位置維持)
        const existing = reader.current
        if (
            existing &&
            existing.prefix === props.prefix &&
            JSON.stringify(existing.query) === JSON.stringify(props.query ?? {}) &&
            existing.body.length > 0
        ) {
            existing.onUpdate = () => {
                update()
            }
            return
        }

        // 初期化: カーソルと表示をリセットしてから Reader を作る
        itemsRef.current = []
        setItems([])
        iter.current = 0
        loadingRef.current = true
        setLoading(true)

        client.newQueryTimelineReader().then((t) => {
            if (isCancelled) return
            t.onUpdate = () => {
                update()
            }
            reader.current = t

            t.init(props.prefix, props.query, props.batchSize ?? DEFAULT_BATCH_SIZE)
                .then((hasMore) => {
                    if (isCancelled) return
                    hasMoreDataRef.current = hasMore
                    setHasMoreData(hasMore)
                    return collectMedias()
                })
                .then((newItems) => {
                    if (isCancelled || !newItems) return
                    itemsRef.current = newItems
                    setItems(newItems)
                })
                .finally(() => {
                    if (isCancelled) return
                    loadingRef.current = false
                    setLoading(false)
                })
        })

        return () => {
            isCancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, props.prefix, props.query, props.batchSize])

    const scrollRef = useRef<HTMLDivElement>(null)

    // Activityがhidden(display:none)の間、ブラウザは内側スクロールコンテナの位置を破棄するため、
    // visible復帰(=effect再マウント)時にscrollPositionRefから復元する。
    // 復帰時のlayout effectはdisplayが戻る前に実行されるため(この時点の書き込みは0にクランプされる)、
    // 書き込みが反映されるまで数フレームrequestAnimationFrameで再試行する
    useLayoutEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const saved = scrollPositionRef.current
        if (saved <= 0) return
        let raf = 0
        let attempts = 0
        const restore = () => {
            el.scrollTop = saved
            if (el.scrollTop !== saved && attempts++ < 10) {
                raf = requestAnimationFrame(restore)
            }
        }
        restore()
        return () => cancelAnimationFrame(raf)
    }, [])

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
        if (!reader.current) return
        setIsFetching(true)
        try {
            iter.current = 0
            itemsRef.current = []
            setItems([])
            const hasMore = await reader.current.reload()
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reader])

    // 追い読み(スクロール末尾とビューアの「次へ」で共用)。続きがあり得るなら true を返す
    const loadMore = useCallback((): Promise<boolean> => {
        if (!reader.current || !hasMoreDataRef.current) return Promise.resolve(false)
        if (readMorePromiseRef.current) return readMorePromiseRef.current

        loadingRef.current = true
        setLoading(true)
        const promise = reader.current
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reader])

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
    }, [scrollRef, reader, hasMoreData, loading, loadMore])

    return (
        <PullToRefresh positionRef={scrollPositionRef} isFetching={isFetching} onRefresh={onRefresh}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    overflowX: 'hidden',
                    overflowY: 'auto',
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
                                                getMedia: (i) => itemsRef.current[i]?.media ?? null,
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
