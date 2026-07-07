import { Suspense, useDeferredValue, useRef, useState } from 'react'
import { Text, TextField, CCWallpaper, Avatar, IconButton, Tab, Tabs, useTheme } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useDrawer } from '../contexts/Drawer'
import { Subscription } from './Subscription'
import { MdPlaylistAdd } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { TimelineView } from '../views/Timeline'
import { ProfileView } from '../views/Profile'
import { useResource } from '../hooks/useResource'

// Crawler API base URL
// https://github.com/concrnt/crawler
const CRAWLER_URL = 'https://crawler.concrnt.net'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommunityHit {
    id: string // Meilisearch内部ID (base64)
    cckv: string // タイムラインURI (例: cckv://domain/t/key)
    name: string
    description?: string
    banner?: string
    owner?: string
    sourceServer?: string
}

export interface UserHit {
    id: string // Meilisearch内部ID (base64)
    ccid: string // ユーザーCCID
    username?: string
    description?: string
    avatar?: string
    banner?: string
    owner?: string
    sourceServer?: string
}

interface SearchResponse<T> {
    hits: T[]
    query: string
    limit: number
    offset: number
    estimatedTotalHits: number
    processingTimeMs: number
}

type TabType = 'communities' | 'users'

// エラーは呼び出し側で表示するためrejectさせずnullをresolveする
const fetchSearch = async (tab: TabType, query: string): Promise<CommunityHit[] | UserHit[] | null> => {
    try {
        const q = encodeURIComponent(query)
        const res = await fetch(`${CRAWLER_URL}/api/v1/search/${tab}?q=${q}&limit=20`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: SearchResponse<CommunityHit | UserHit> = await res.json()
        return data.hits as CommunityHit[] | UserHit[]
    } catch {
        return null
    }
}

// ─── Main component ───────────────────────────────────────────────────────────

export const SearchExplorer = () => {
    const theme = useTheme()
    const activeColor = theme.variant === 'classic' ? CssVar.backdropBackground : CssVar.contentLink
    const inactiveColor = `rgb(from ${CssVar.contentText} r g b / 0.35)`
    const tabStyle = (selected: boolean) => ({
        color: selected ? activeColor : inactiveColor,
        fontWeight: selected ? ('bold' as const) : ('normal' as const)
    })

    const [tab, setTab] = useState<TabType>('communities')
    const [query, setQuery] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // タブと入力欄は即時反応させ、結果リストだけ遅れて追従させる
    const deferredTab = useDeferredValue(tab)
    const deferredQuery = useDeferredValue(searchQuery)
    const isStale = deferredTab !== tab || deferredQuery !== searchQuery

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <Tabs>
                <Tab
                    selected={tab === 'communities'}
                    groupId="search-explorer"
                    style={tabStyle(tab === 'communities')}
                    onClick={() => setTab('communities')}
                >
                    <Text>コミュニティ</Text>
                </Tab>
                <Tab
                    selected={tab === 'users'}
                    groupId="search-explorer"
                    style={tabStyle(tab === 'users')}
                    onClick={() => setTab('users')}
                >
                    <Text>ユーザー</Text>
                </Tab>
            </Tabs>

            <TextField
                value={query}
                placeholder={tab === 'communities' ? 'コミュニティを検索...' : 'ユーザーを検索...'}
                onChange={(e) => {
                    const value = e.target.value
                    setQuery(value)
                    if (debounceRef.current) clearTimeout(debounceRef.current)
                    debounceRef.current = setTimeout(() => {
                        setSearchQuery(value)
                    }, 300)
                }}
            />

            <div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <Suspense fallback={<Text variant="caption">読み込み中...</Text>}>
                    <SearchResults tab={deferredTab} query={deferredQuery} />
                </Suspense>
            </div>
        </div>
    )
}

const SearchResults = ({ tab, query }: { tab: TabType; query: string }) => {
    const hits = useResource(`crawler-search:${tab}:${query}`, () => fetchSearch(tab, query))

    if (hits === null) {
        return (
            <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                検索サービスに接続できませんでした
            </Text>
        )
    }

    if (hits.length === 0) {
        return (
            <Text variant="caption" style={{ opacity: 0.5 }}>
                {tab === 'communities'
                    ? '該当するコミュニティが見つかりませんでした'
                    : '該当するユーザーが見つかりませんでした'}
            </Text>
        )
    }

    return tab === 'communities' ? (
        <CommunityResultList communities={hits as CommunityHit[]} />
    ) : (
        <UserResultList users={hits as UserHit[]} />
    )
}

// ─── Community list ───────────────────────────────────────────────────────────

const CommunityResultList = ({ communities }: { communities: CommunityHit[] }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
        {communities.map((c) => (
            <CommunityResultCard key={c.id} community={c} />
        ))}
    </div>
)

const CommunityResultCard = ({ community }: { community: CommunityHit }) => {
    const drawer = useDrawer()
    const { push } = useStack()

    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                display: 'flex',
                overflow: 'hidden',
                height: '7rem',
                minHeight: '7rem',
                cursor: 'pointer'
            }}
        >
            <CCWallpaper style={{ height: '100%', aspectRatio: '1/1', flexShrink: 0 }} src={community.banner} />
            <div
                style={{
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1,
                    minWidth: 0
                }}
                onClick={() => push(<TimelineView uri={community.cckv} />)}
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
                            drawer.open(<Subscription target={community.cckv} />)
                        }}
                    >
                        <MdPlaylistAdd size={24} />
                    </IconButton>
                </div>
            </div>
        </div>
    )
}

// ─── User list ────────────────────────────────────────────────────────────────

const UserResultList = ({ users }: { users: UserHit[] }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
        {users.map((u) => (
            <UserResultCard key={u.id} user={u} />
        ))}
    </div>
)

const UserResultCard = ({ user }: { user: UserHit }) => {
    const { push } = useStack()
    const ccid = user.ccid

    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer'
            }}
            onClick={() => push(<ProfileView ccid={ccid} />)}
        >
            <CCWallpaper style={{ height: '60px', width: '100%' }} src={user.banner} />
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
