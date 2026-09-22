import { Fragment, Suspense, useDeferredValue, useRef, useState, useTransition } from 'react'
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
    useAnchor,
    useTheme
} from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { Drawer } from './Drawer'
import { Select } from './Select'
import { Subscription } from './Subscription'
import { MdArrowDropDown, MdCheck, MdClear, MdPlaylistAdd } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import { useResource } from '../hooks/useResource'
import { usePersistent } from '../hooks/usePersistent'
import { useIsMobile } from '../hooks/useIsMobile'
import { useMediaProxy } from '../contexts/MediaProxy'
import { MessageContainer } from './message'
import { RenderError } from './message/RenderError'
import { MessageSkeleton } from './message/MessageSkeleton'

// Crawler API base URL
// https://github.com/concrnt/crawler
const CRAWLER_URL = 'https://crawler.concrnt.net'

// 検索結果の1ページ分。「もっと見る」でこの分ずつlimitを増やす(crawlerの上限は100)
const PAGE_SIZE = 20
const MAX_LIMIT = 100
// 検索語が空のときに並べる新着/アクティブの件数
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
        const res = await fetch(`${CRAWLER_URL}/api/v1/search/${tab}?${search}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
    } catch {
        return null
    }
}

type CommunitySort = 'relevance' | 'createdAt' | 'activityScore'
type LandingSort = 'createdAt' | 'activityScore'

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

    const [tab, setTab] = useState<SearchTab>('posts')
    const [communitySort, setCommunitySort] = useState<CommunitySort>('relevance')
    const [landingSort, setLandingSort] = usePersistent<LandingSort>('explorer-landing-community-sort', 'createdAt')
    const [query, setQuery] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isMobile = useIsMobile()
    // モバイル幅では見出し「アクティブなコミュニティ」と並び順「アクティブ」が1行に収まらず折り返すため、両方を詰める
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
    const isStale =
        deferredTab !== tab ||
        deferredQuery !== searchQuery ||
        deferredCommunitySort !== communitySort ||
        deferredLandingSort !== landingSort

    const resultSort = deferredCommunitySort === 'relevance' ? undefined : `${deferredCommunitySort}:desc`

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                <TextField
                    value={query}
                    placeholder={t('searchPlaceholder')}
                    onChange={(e) => {
                        const value = e.target.value
                        setQuery(value)
                        if (debounceRef.current) clearTimeout(debounceRef.current)
                        debounceRef.current = setTimeout(() => {
                            setSearchQuery(value)
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
                {query && (
                    <IconButton onClick={clearSearch} title={t('clearSearch')}>
                        <MdClear size={20} />
                    </IconButton>
                )}
            </div>

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
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: CssVar.space(2)
                        }}
                    >
                        <Text variant="h3" style={headingStyle}>
                            {landingSort === 'activityScore' ? t('activeCommunities') : t('newCommunities')}
                        </Text>
                        <SortSelect<LandingSort>
                            options={[
                                { value: 'createdAt', label: t('sortNewest') },
                                { value: 'activityScore', label: t('sortActive') }
                            ]}
                            value={landingSort}
                            onChange={setLandingSort}
                            style={sortStyle}
                        />
                    </div>
                    <Suspense fallback={<Text variant="caption">{t('loading')}</Text>}>
                        <CommunityResults query="" sort={`${deferredLandingSort}:desc`} limit={LANDING_SIZE} />
                    </Suspense>
                    <Text variant="h3" style={headingStyle}>
                        {t('newUsers')}
                    </Text>
                    <Suspense fallback={<Text variant="caption">{t('loading')}</Text>}>
                        <UserResults query="" sort="createdAt:desc" limit={LANDING_SIZE} />
                    </Suspense>
                </div>
            ) : (
                <>
                    <Tabs>
                        <Tab
                            selected={tab === 'posts'}
                            groupId="search-explorer"
                            style={tabStyle(tab === 'posts')}
                            onClick={() => setTab('posts')}
                        >
                            <Text>{t('posts')}</Text>
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
                            selected={tab === 'communities'}
                            groupId="search-explorer"
                            style={tabStyle(tab === 'communities')}
                            onClick={() => setTab('communities')}
                        >
                            <Text>{t('communities')}</Text>
                        </Tab>
                    </Tabs>

                    {tab === 'communities' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <SortSelect<CommunitySort>
                                options={[
                                    { value: 'relevance', label: t('sortRelevance') },
                                    { value: 'createdAt', label: t('sortNewest') },
                                    { value: 'activityScore', label: t('sortActive') }
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
                            key={`${deferredTab}:${deferredQuery}:${resultSort ?? ''}`}
                            fallback={<Text variant="caption">{t('loading')}</Text>}
                        >
                            {deferredTab === 'posts' ? (
                                <PostResults query={deferredQuery} loadMore />
                            ) : deferredTab === 'users' ? (
                                <UserResults query={deferredQuery} loadMore />
                            ) : (
                                <CommunityResults query={deferredQuery} sort={resultSort} loadMore />
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
    loadMore?: boolean
}

// limitを伸ばす方式のページング。offset分割より単純で、useResourceのキーにlimitを含めるだけで済む
const useSearchResults = <T extends SearchTab>(tab: T, props: ResultsProps) => {
    const [limit, setLimit] = useState(props.limit ?? PAGE_SIZE)
    const [isPending, startTransition] = useTransition()
    const result = useResource(`crawler-search:${tab}:${props.query}:${props.sort ?? ''}:${limit}`, () =>
        fetchSearch(tab, { q: props.query, sort: props.sort, limit })
    )
    const hasMore =
        !!props.loadMore && result !== null && result.hits.length < result.estimatedTotalHits && limit < MAX_LIMIT
    const loadMore = () => {
        startTransition(() => {
            setLimit((l) => Math.min(MAX_LIMIT, l + PAGE_SIZE))
        })
    }
    return { result, hasMore, isPending, loadMore }
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
    const { result, hasMore, isPending, loadMore } = useSearchResults('communities', props)

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
                {t('noCommunitiesFound')}
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
            {result.hits.map((c) => (
                <CommunityResultCard key={c.id} community={c} />
            ))}
            <LoadMoreButton visible={hasMore} disabled={isPending} onClick={loadMore} />
        </div>
    )
}

const UserResults = (props: ResultsProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.searchExplorer' })
    const { result, hasMore, isPending, loadMore } = useSearchResults('users', props)

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
                {t('noUsersFound')}
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
            {result.hits.map((u) => (
                <UserResultCard key={u.id} user={u} />
            ))}
            <LoadMoreButton visible={hasMore} disabled={isPending} onClick={loadMore} />
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
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton
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

// ─── User card ────────────────────────────────────────────────────────────────

const UserResultCard = ({ user }: { user: UserHit }) => {
    const { getImageURL } = useMediaProxy()
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
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2)
                }}
            >
                <Avatar
                    ccid={ccid}
                    src={user.avatar}
                    style={{ width: '48px', height: '48px', borderRadius: '4px', flexShrink: 0 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
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
