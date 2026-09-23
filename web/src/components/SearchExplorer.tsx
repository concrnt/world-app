import { Fragment, Suspense, useDeferredValue, useMemo, useRef, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Text,
    TextField,
    CCWallpaper,
    Avatar,
    IconButton,
    Tab,
    Tabs,
    Button,
    Divider,
    ListItem,
    Sparkline,
    ToggleGroup,
    useAnchor,
    useTheme
} from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { Drawer } from './Drawer'
import { Select } from './Select'
import { Subscription } from './Subscription'
import {
    MdArrowDropDown,
    MdCheck,
    MdChevronLeft,
    MdChevronRight,
    MdClear,
    MdPlaylistAdd,
    MdSearch
} from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import { useResource } from '../hooks/useResource'
import { usePersistent } from '../hooks/usePersistent'
import { useIsMobile } from '../hooks/useIsMobile'
import { useMediaProxy } from '../contexts/MediaProxy'
import { useClient } from '../contexts/Client'
import { MessageContainer } from './message'
import { RenderError } from './message/RenderError'
import { MessageSkeleton } from './message/MessageSkeleton'

// Crawler API base URL
// https://github.com/concrnt/crawler
const CRAWLER_URL = 'https://crawler.concrnt.net'

// 検索結果の1ページ分。「もっと見る」でこの分ずつlimitを増やす(crawlerの上限は100)
const PAGE_SIZE = 20
const MAX_LIMIT = 100
// 検索語が空のときに並べる新着/アクティブの1ページあたりの件数(前/次で offset を送る)
const LANDING_SIZE = 6

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityDay {
    date: string // YYYY-MM-DD (UTC)
    posts: number
    authors: number
}

export interface CommunityHit {
    id: string // Meilisearch内部ID (base64)
    cckv: string // タイムラインURI (例: cckv://domain/t/key)
    name: string
    description?: string
    banner?: string
    owner?: string
    sourceServer?: string
    // 活動集計(crawlerの集計tickが未到達のdocでは欠落する)
    activityScore?: number
    postCount7d?: number
    postCount30d?: number
    activeAuthors7d?: number
    lastPostAt?: string
    activityHistory?: ActivityDay[] // 30日分・古い順・0埋め・末尾が当日
    // viewer指定時のみ: 閲覧者のフォロー先に絞った集計
    followeeScore?: number
    followeePostCount30d?: number
    topAuthors?: string[] // このコミュニティに多く投稿したフォロー先のCCID(投稿数順・最大5人)
}

// ユーザーの日別活動量。1人の著者なので投稿数だけ
export interface UserActivityDay {
    date: string // YYYY-MM-DD (UTC)
    posts: number
}

export interface UserHit {
    id: string // Meilisearch内部ID (base64)
    ccid: string // ユーザーCCID
    cckv?: string // プロフィールドキュメントのキー(サブプロフィールなら末尾がmain以外)
    username?: string
    description?: string
    avatar?: string
    banner?: string
    owner?: string
    sourceServer?: string
    // 活動集計(グローバル。crawlerの集計tickが未到達のdocでは欠落する)
    activityScore?: number
    postCount7d?: number
    postCount30d?: number
    lastPostAt?: string
    activityHistory?: UserActivityDay[]
    // viewer指定時のみ
    followeeScore?: number
    followeePostCount30d?: number
}

export interface PostHit {
    id: string // Meilisearch内部ID (base64)
    cckv: string // 投稿レコードのキー
    author: string
    owner?: string
    sourceServer?: string // 投稿の所在サーバーFQDN(解決hintに使う)
    schema: string
    body?: string
    createdAt: string
}

export interface SearchResponse<T> {
    hits: T[]
    query: string
    limit: number
    offset: number
    estimatedTotalHits: number
    processingTimeMs: number
}

export type SearchTab = 'posts' | 'users' | 'communities'
type HitOf<T extends SearchTab> = T extends 'communities' ? CommunityHit : T extends 'users' ? UserHit : PostHit

export interface SearchParams {
    q: string
    sort?: string // 未指定は関連度順(空クエリではcrawler既定のcreatedAt:desc)
    limit?: number
    offset?: number
    viewer?: string // 閲覧者CCID。指定するとフォロー先の活動で順位付けした一覧になる(q/sortは送れない)
}

// エラーは呼び出し側で表示するためrejectさせずnullをresolveする
export const fetchSearch = async <T extends SearchTab>(
    tab: T,
    params: SearchParams
): Promise<SearchResponse<HitOf<T>> | null> => {
    try {
        const search = new URLSearchParams({ q: params.q, limit: String(params.limit ?? PAGE_SIZE) })
        if (params.offset) search.set('offset', String(params.offset))
        if (params.sort) search.set('sort', params.sort)
        if (params.viewer) search.set('viewer', params.viewer)
        const res = await fetch(`${CRAWLER_URL}/api/v1/search/${tab}?${search}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
    } catch {
        return null
    }
}

// 検索結果の並び。followee はフォロー中の人の活動順(viewer付き・crawlerが一致分を先頭に並べ残りは関連度順で続ける)
type CommunitySort = 'relevance' | 'createdAt' | 'followee' | 'activityScore'
// 空クエリ一覧の並び。followee はフォロー中の人の活動(viewer付き)、activityScore はグローバルな活動量
type LandingSort = 'createdAt' | 'followee' | 'activityScore'
type UserLandingSort = 'createdAt' | 'activityScore'

// ─── Main component ───────────────────────────────────────────────────────────

export const SearchExplorer = () => {
    const { t } = useTranslation('', { keyPrefix: 'components.searchExplorer' })
    const theme = useTheme()
    const activeColor = theme.variant === 'classic' ? CssVar.backdropBackground : CssVar.contentLink
    const inactiveColor = `rgb(from ${CssVar.contentText} r g b / 0.35)`
    const tabStyle = (selected: boolean) => ({
        color: selected ? activeColor : inactiveColor,
        fontWeight: selected ? ('bold' as const) : ('normal' as const)
    })

    // 検索語が無くても一覧が出るコミュニティタブから始める
    const [tab, setTab] = useState<SearchTab>('communities')
    const { client } = useClient()
    // ゲスト(ccid空)にはフォロー先が無いので、フォロー中の人が活発な一覧は出さない
    const viewer = client.ccid !== '' ? client.ccid : undefined
    // 検索結果はフォロー中の人が活発な順を既定にする(ゲストはグローバルな活動順)
    const [communitySort, setCommunitySort] = useState<CommunitySort>(viewer ? 'followee' : 'activityScore')
    const [landingSort, setLandingSort] = usePersistent<LandingSort>('explorer-landing-community-sort', 'createdAt')
    const [userSort, setUserSort] = usePersistent<UserLandingSort>('explorer-landing-user-sort', 'createdAt')
    const [query, setQuery] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isMobile = useIsMobile()
    // モバイル幅では見出しと並び順ボタンが1行に収まらず折り返すため、両方を詰める
    const headingStyle = isMobile ? { fontSize: '1em' } : undefined
    const sortStyle = isMobile ? { fontSize: '0.9rem' } : undefined

    const clearSearch = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setQuery('')
        setSearchQuery('')
    }

    // タブと入力欄は即時反応させ、結果リストだけ遅れて追従させる
    const deferredTab = useDeferredValue(tab)
    const deferredQuery = useDeferredValue(searchQuery)
    const deferredCommunitySort = useDeferredValue(communitySort)
    const deferredLandingSort = useDeferredValue(landingSort)
    const deferredUserSort = useDeferredValue(userSort)
    const isStale =
        deferredTab !== tab ||
        deferredQuery !== searchQuery ||
        deferredCommunitySort !== communitySort ||
        deferredLandingSort !== landingSort ||
        deferredUserSort !== userSort

    const resultSort =
        deferredCommunitySort === 'relevance' || deferredCommunitySort === 'followee'
            ? undefined
            : `${deferredCommunitySort}:desc`
    // ゲストはフォロー先が無いので、保存値が followee でも新着として扱う
    const effectiveLandingSort =
        viewer === undefined && deferredLandingSort === 'followee' ? 'createdAt' : deferredLandingSort

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <TextField
                value={query}
                placeholder={t('searchPlaceholder')}
                startAdornment={<MdSearch size={20} style={{ opacity: 0.5, flexShrink: 0 }} />}
                endAdornment={
                    query ? (
                        <IconButton onClick={clearSearch} title={t('clearSearch')}>
                            <MdClear size={20} />
                        </IconButton>
                    ) : undefined
                }
                onChange={(e) => {
                    const value = e.target.value
                    setQuery(value)
                    if (debounceRef.current) clearTimeout(debounceRef.current)
                    // 入力中に文字を全部消しても直前の結果を出したままにする(一覧へ戻るのはblur時)。
                    // 打ち直しのたびに一覧と結果が入れ替わってチラつくのを避ける
                    if (value === '') return
                    debounceRef.current = setTimeout(() => {
                        setSearchQuery(value)
                    }, 300)
                }}
                onBlur={() => {
                    if (query !== '') return
                    if (debounceRef.current) clearTimeout(debounceRef.current)
                    // 即時に戻すと、結果カードをタップした際の blur で差し替わりタップ先が消えるので少し待つ
                    debounceRef.current = setTimeout(() => {
                        setSearchQuery('')
                    }, 300)
                }}
                onKeyDown={(e) => {
                    // Enterで検索を確定してフォーカスを外す(モバイルではキーボードが閉じる)。日本語入力の確定Enterは除外
                    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                    if (debounceRef.current) clearTimeout(debounceRef.current)
                    setSearchQuery(query)
                    e.currentTarget.blur()
                }}
            />

            <Tabs>
                <Tab
                    selected={tab === 'communities'}
                    groupId="search-explorer"
                    style={tabStyle(tab === 'communities')}
                    onClick={() => setTab('communities')}
                >
                    <Text>{t('communities')}</Text>
                </Tab>
                <Tab
                    selected={tab === 'users'}
                    groupId="search-explorer"
                    style={tabStyle(tab === 'users')}
                    onClick={() => setTab('users')}
                >
                    <Text>{t('users')}</Text>
                </Tab>
                <Tab
                    selected={tab === 'posts'}
                    groupId="search-explorer"
                    style={tabStyle(tab === 'posts')}
                    onClick={() => setTab('posts')}
                >
                    <Text>{t('posts')}</Text>
                </Tab>
            </Tabs>

            {deferredQuery === '' ? (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2),
                        opacity: isStale ? 0.6 : 1,
                        transition: 'opacity 0.2s'
                    }}
                >
                    {deferredTab === 'posts' ? (
                        <Text variant="caption" style={{ opacity: 0.5 }}>
                            {t('postsHint')}
                        </Text>
                    ) : deferredTab === 'users' ? (
                        <>
                            <Text variant="h3" style={headingStyle}>
                                {userSort === 'activityScore' ? t('globalActiveUsers') : t('newUsers')}
                            </Text>
                            {/* コミュニティ側と同じ位置に同じ型の要素が並ぶので、keyを付けないとReactが同一インスタンスとして使い回し、選択ピルが前のタブの位置から滑ってくる */}
                            <ToggleGroup<UserLandingSort>
                                key="users"
                                options={[
                                    { value: 'createdAt', label: t('sortNewest') },
                                    { value: 'activityScore', label: t('sortGlobal') }
                                ]}
                                value={userSort}
                                onChange={setUserSort}
                            />
                            <Suspense fallback={<Text variant="caption">{t('loading')}</Text>}>
                                <UserResults
                                    key={deferredUserSort}
                                    query=""
                                    sort={`${deferredUserSort}:desc`}
                                    limit={LANDING_SIZE}
                                    paged
                                />
                            </Suspense>
                        </>
                    ) : (
                        <>
                            {/* ボタンは短い語にして見出しを選択に連動させる(3択の長いラベルはモバイル幅で省略される) */}
                            <Text variant="h3" style={headingStyle}>
                                {landingSort === 'followee' && viewer
                                    ? t('followeeActiveCommunities')
                                    : landingSort === 'activityScore'
                                      ? t('globalActiveCommunities')
                                      : t('newCommunities')}
                            </Text>
                            <ToggleGroup<LandingSort>
                                key="communities"
                                options={[
                                    { value: 'createdAt', label: t('sortNewest') },
                                    ...(viewer ? [{ value: 'followee' as const, label: t('sortFollowee') }] : []),
                                    { value: 'activityScore', label: t('sortGlobal') }
                                ]}
                                value={viewer === undefined && landingSort === 'followee' ? 'createdAt' : landingSort}
                                onChange={setLandingSort}
                            />
                            <Suspense fallback={<Text variant="caption">{t('loading')}</Text>}>
                                {/* keyで並び順切替時にページ位置をリセットする。Suspense自体をkeyにすると新境界扱いで旧内容が残らない */}
                                {effectiveLandingSort === 'followee' ? (
                                    <CommunityResults
                                        key="followee"
                                        query=""
                                        viewer={viewer}
                                        limit={LANDING_SIZE}
                                        paged
                                        emptyText={t('noFolloweeCommunities')}
                                    />
                                ) : (
                                    <CommunityResults
                                        key={effectiveLandingSort}
                                        query=""
                                        sort={`${effectiveLandingSort}:desc`}
                                        limit={LANDING_SIZE}
                                        paged
                                    />
                                )}
                            </Suspense>
                        </>
                    )}
                </div>
            ) : (
                <>
                    {tab === 'communities' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <SortSelect<CommunitySort>
                                options={[
                                    { value: 'relevance', label: t('sortRelevance') },
                                    { value: 'createdAt', label: t('sortNewest') },
                                    ...(viewer ? [{ value: 'followee' as const, label: t('sortFolloweeActive') }] : []),
                                    { value: 'activityScore', label: t('sortGlobalActive') }
                                ]}
                                value={communitySort}
                                onChange={setCommunitySort}
                                style={sortStyle}
                            />
                        </div>
                    )}

                    <div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                        {/* keyで結果コンポーネントを作り直し、「もっと見る」で伸ばしたlimitを条件ごとにリセットする */}
                        <Suspense
                            key={`${deferredTab}:${deferredQuery}:${deferredCommunitySort}`}
                            fallback={<Text variant="caption">{t('loading')}</Text>}
                        >
                            {deferredTab === 'posts' ? (
                                <PostResults query={deferredQuery} loadMore />
                            ) : deferredTab === 'users' ? (
                                <UserResults query={deferredQuery} loadMore />
                            ) : (
                                <CommunityResults
                                    query={deferredQuery}
                                    sort={resultSort}
                                    viewer={deferredCommunitySort === 'followee' ? viewer : undefined}
                                    loadMore
                                />
                            )}
                        </Suspense>
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Sort select ──────────────────────────────────────────────────────────────

interface SortSelectProps<T extends string> {
    options: Array<{ value: T; label: string }>
    value: T
    onChange: (value: T) => void
    style?: React.CSSProperties
}

// 現在の並び順を示すボタンから選択肢を開くドロップダウン
const SortSelect = <T extends string>(props: SortSelectProps<T>) => {
    const [open, setOpen] = useState(false)
    const anchor = useAnchor()
    const current = props.options.find((o) => o.value === props.value)

    return (
        <>
            <Button
                variant="text"
                endIcon={<MdArrowDropDown size={20} />}
                // 折り返して崩れないよう1行固定。見出し側を縮めて収める
                style={
                    { anchorName: anchor, flexShrink: 0, whiteSpace: 'nowrap', ...props.style } as React.CSSProperties
                }
                onClick={() => setOpen(true)}
            >
                {current?.label}
            </Button>
            <Select
                open={open}
                onClose={() => setOpen(false)}
                anchor={anchor}
                options={props.options.map((o) => (
                    <ListItem
                        key={o.value}
                        endIcon={o.value === props.value ? <MdCheck size={20} /> : undefined}
                        onClick={() => {
                            props.onChange(o.value)
                            setOpen(false)
                        }}
                    >
                        <Text>{o.label}</Text>
                    </ListItem>
                ))}
            />
        </>
    )
}

// ─── Result lists ─────────────────────────────────────────────────────────────

interface ResultsProps {
    query: string
    sort?: string
    limit?: number
    loadMore?: boolean // 「もっと見る」でlimitを伸ばす(検索結果向け)
    paged?: boolean // 前/次でoffsetをlimit刻みに送る(空クエリの新着/アクティブ向け)
    viewer?: string // 閲覧者CCID(フォロー中でアクティブ)
    emptyText?: string // 0件時の文言(既定は「該当なし」)
}

// 検索結果はlimitを伸ばす方式。offset分割より単純で、useResourceのキーにlimitを含めるだけで済む
// 空クエリの一覧は2セクションが縦に並ぶので、追い読みで下のセクションを押し下げないようページ送り(offset)にする
const useSearchResults = <T extends SearchTab>(tab: T, props: ResultsProps) => {
    const [limit, setLimit] = useState(props.limit ?? PAGE_SIZE)
    const [page, setPage] = useState(0)
    const [isPending, startTransition] = useTransition()
    const offset = page * limit
    const result = useResource(
        `crawler-search:${tab}:${props.query}:${props.sort ?? ''}:${props.viewer ?? ''}:${limit}:${offset}`,
        () => fetchSearch(tab, { q: props.query, sort: props.sort, viewer: props.viewer, limit, offset })
    )
    const remaining = result === null ? 0 : result.estimatedTotalHits - offset - result.hits.length
    const hasMore = !!props.loadMore && remaining > 0 && limit < MAX_LIMIT
    const loadMore = () => {
        startTransition(() => {
            setLimit((l) => Math.min(MAX_LIMIT, l + PAGE_SIZE))
        })
    }
    // estimatedTotalHitsは概算なので、次ページが空だった場合も戻れるよう2ページ目以降はページャーを出し続ける
    const hasNext = remaining > 0
    const pager = props.paged && (page > 0 || hasNext) ? { page, hasNext } : undefined
    const goPage = (delta: number) => {
        startTransition(() => {
            setPage((p) => Math.max(0, p + delta))
        })
    }
    return { result, hasMore, isPending, loadMore, pager, goPage }
}

// 前/次ボタンと現在ページ。ページャーが不要(1ページに収まる)なら描画しない
const Pager = (props: {
    pager?: { page: number; hasNext: boolean }
    disabled: boolean
    onChange: (delta: number) => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.searchExplorer' })
    if (!props.pager) return null
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: CssVar.space(1) }}>
            <IconButton
                disabled={props.disabled || props.pager.page === 0}
                title={t('prevPage')}
                onClick={() => props.onChange(-1)}
            >
                <MdChevronLeft size={24} />
            </IconButton>
            <Text variant="caption">{t('pageIndicator', { page: props.pager.page + 1 })}</Text>
            <IconButton
                disabled={props.disabled || !props.pager.hasNext}
                title={t('nextPage')}
                onClick={() => props.onChange(1)}
            >
                <MdChevronRight size={24} />
            </IconButton>
        </div>
    )
}

const LoadMoreButton = (props: { visible: boolean; disabled: boolean; onClick: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.searchExplorer' })
    if (!props.visible) return null
    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="text" disabled={props.disabled} onClick={props.onClick}>
                {t('loadMore')}
            </Button>
        </div>
    )
}

const PostResults = (props: ResultsProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.searchExplorer' })
    const { result, hasMore, isPending, loadMore } = useSearchResults('posts', props)

    if (result === null) {
        return (
            <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                {t('searchServiceUnavailable')}
            </Text>
        )
    }
    if (result.hits.length === 0) {
        return (
            <Text variant="caption" style={{ opacity: 0.5 }}>
                {t('noPostsFound')}
            </Text>
        )
    }
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                opacity: isPending ? 0.6 : 1,
                transition: 'opacity 0.2s'
            }}
        >
            {/* QueryTimelineの行構造(gap 8px+Divider)に合わせる */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Divider />
                {result.hits.map((hit) => (
                    <Fragment key={hit.id}>
                        <ErrorBoundary FallbackComponent={RenderError}>
                            <Suspense fallback={<MessageSkeleton />}>
                                <MessageContainer uri={hit.cckv} hint={hit.sourceServer} />
                            </Suspense>
                        </ErrorBoundary>
                        <Divider />
                    </Fragment>
                ))}
            </div>
            <LoadMoreButton visible={hasMore} disabled={isPending} onClick={loadMore} />
        </div>
    )
}

const CommunityResults = (props: ResultsProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.searchExplorer' })
    const { result, hasMore, isPending, loadMore, pager, goPage } = useSearchResults('communities', props)

    if (result === null) {
        return (
            <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                {t('searchServiceUnavailable')}
            </Text>
        )
    }
    const empty = (
        <Text variant="caption" style={{ opacity: 0.5 }}>
            {props.emptyText ?? t('noCommunitiesFound')}
        </Text>
    )
    if (result.hits.length === 0 && !pager) return empty
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                opacity: isPending ? 0.6 : 1,
                transition: 'opacity 0.2s'
            }}
        >
            {result.hits.length === 0
                ? empty
                : result.hits.map((c) => <CommunityResultCard key={c.id} community={c} />)}
            <LoadMoreButton visible={hasMore} disabled={isPending} onClick={loadMore} />
            <Pager pager={pager} disabled={isPending} onChange={goPage} />
        </div>
    )
}

const UserResults = (props: ResultsProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.searchExplorer' })
    const { result, hasMore, isPending, loadMore, pager, goPage } = useSearchResults('users', props)

    if (result === null) {
        return (
            <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                {t('searchServiceUnavailable')}
            </Text>
        )
    }
    const empty = (
        <Text variant="caption" style={{ opacity: 0.5 }}>
            {props.emptyText ?? t('noUsersFound')}
        </Text>
    )
    if (result.hits.length === 0 && !pager) return empty
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                opacity: isPending ? 0.6 : 1,
                transition: 'opacity 0.2s'
            }}
        >
            {result.hits.length === 0 ? empty : result.hits.map((u) => <UserResultCard key={u.id} user={u} />)}
            <LoadMoreButton visible={hasMore} disabled={isPending} onClick={loadMore} />
            <Pager pager={pager} disabled={isPending} onChange={goPage} />
        </div>
    )
}

// ─── Community card ───────────────────────────────────────────────────────────

const CommunityResultCard = ({ community }: { community: CommunityHit }) => {
    const { getImageURL } = useMediaProxy()
    const theme = useTheme()
    const navigate = useNavigate()
    const [subscriptionOpen, setSubscriptionOpen] = useState(false)
    const graphColor = theme.variant === 'classic' ? CssVar.backdropBackground : CssVar.contentLink

    return (
        <div
            style={{
                position: 'relative',
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                display: 'flex',
                overflow: 'hidden',
                height: '7rem',
                minHeight: '7rem',
                cursor: 'pointer'
            }}
        >
            {/* 直近30日の日別投稿数を右側の背景に敷く。左へフェードさせて文字と干渉させない */}
            {community.activityHistory && (
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: '55%',
                        pointerEvents: 'none',
                        opacity: 0.25,
                        color: graphColor,
                        maskImage: 'linear-gradient(to right, transparent, black 65%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent, black 65%)'
                    }}
                >
                    <Sparkline values={community.activityHistory.map((d) => d.posts)} />
                </div>
            )}
            <CCWallpaper
                style={{ height: '100%', aspectRatio: '1/1', flexShrink: 0 }}
                src={getImageURL(community.banner)}
            />
            <div
                style={{
                    position: 'relative',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1,
                    minWidth: 0
                }}
                onClick={() => navigate('/timeline/' + encodeURIComponent(community.cckv))}
            >
                <Text variant="h4" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {community.name}
                </Text>
                <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
                    {community.description}
                </Text>
                {community.sourceServer && (
                    <Text
                        variant="caption"
                        style={{ opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                        {community.sourceServer}
                    </Text>
                )}
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                    {/* フォロー中でアクティブ: このコミュニティに投稿している人を重ねたアバターで示す */}
                    {community.topAuthors && community.topAuthors.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {community.topAuthors.map((ccid, i) => (
                                <div
                                    key={ccid}
                                    style={{
                                        marginLeft: i > 0 ? '-6px' : '0',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: `1.5px solid ${CssVar.contentBackground}`,
                                        width: '22px',
                                        height: '22px',
                                        flexShrink: 0
                                    }}
                                >
                                    <TopAuthorAvatar ccid={ccid} />
                                </div>
                            ))}
                        </div>
                    )}
                    <IconButton
                        style={{ marginLeft: 'auto' }}
                        onClick={(e) => {
                            e.stopPropagation()
                            setSubscriptionOpen(true)
                        }}
                    >
                        <MdPlaylistAdd size={24} />
                    </IconButton>
                    <Drawer open={subscriptionOpen} onClose={() => setSubscriptionOpen(false)}>
                        <Subscription target={community.cckv} />
                    </Drawer>
                </div>
            </div>
        </div>
    )
}

// 並び順切替の遅延レンダー中に毎レンダー新しいPromiseを渡すとAvatarが解決→再サスペンドを繰り返して切替が確定しないので、CCIDごとにPromiseを固定する
const TopAuthorAvatar = ({ ccid }: { ccid: string }) => {
    const { client } = useClient()
    const src = useMemo(() => client.getUser(ccid).then((user) => user?.profile.avatar), [client, ccid])
    return <Avatar ccid={ccid} src={src} style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
}

// ─── User card ────────────────────────────────────────────────────────────────

const UserResultCard = ({ user }: { user: UserHit }) => {
    const { getImageURL } = useMediaProxy()
    const theme = useTheme()
    const graphColor = theme.variant === 'classic' ? CssVar.backdropBackground : CssVar.contentLink
    const navigate = useNavigate()
    const ccid = user.ccid
    // サブプロフィールもmainと同じスキーマでインデックスされるので、キー末尾のプロフィール名をURLに載せる
    const profileName = user.cckv?.split('/concrnt.world/profiles/')[1]

    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer'
            }}
            onClick={() =>
                navigate(
                    '/profile/' +
                        encodeURIComponent(ccid) +
                        (profileName && profileName !== 'main' ? '/' + encodeURIComponent(profileName) : '') +
                        // 自ドメインが未知のユーザーでも解決できるよう、所在サーバーをhintとして運ぶ
                        (user.sourceServer ? '?hint=' + encodeURIComponent(user.sourceServer) : '')
                )
            }
        >
            <CCWallpaper style={{ height: '60px', width: '100%' }} src={getImageURL(user.banner)} />
            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2)
                }}
            >
                {/* コミュニティカードと同じく、直近30日の日別投稿数を右側の背景に敷く */}
                {user.activityHistory && (
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: '55%',
                            pointerEvents: 'none',
                            opacity: 0.25,
                            color: graphColor,
                            maskImage: 'linear-gradient(to right, transparent, black 65%)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent, black 65%)'
                        }}
                    >
                        <Sparkline values={user.activityHistory.map((d) => d.posts)} />
                    </div>
                )}
                <Avatar
                    ccid={ccid}
                    src={user.avatar}
                    style={{ width: '48px', height: '48px', borderRadius: '4px', flexShrink: 0, position: 'relative' }}
                />
                <div
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}
                >
                    <Text variant="h4" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.username ?? 'Anonymous'}
                    </Text>
                    <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
                        {user.description}
                    </Text>
                    {user.sourceServer && (
                        <Text variant="caption" style={{ opacity: 0.5 }}>
                            {user.sourceServer}
                        </Text>
                    )}
                </div>
            </div>
        </div>
    )
}
