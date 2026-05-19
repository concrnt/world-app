import { useState, useEffect, useRef, useCallback } from 'react'
import { Text, TextField, CCWallpaper, Avatar, IconButton, Tab, Tabs, useTheme } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useDrawer } from '../contexts/Drawer'
import { Subscription } from './Subscription'
import { MdPlaylistAdd, MdCasino } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { TimelineView } from '../views/Timeline'
import { ProfileView } from '../views/Profile'

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
    const [communities, setCommunities] = useState<CommunityHit[]>([])
    const [users, setUsers] = useState<UserHit[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [shuffleSeed, setShuffleSeed] = useState(0)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchData = useCallback(async (currentTab: TabType, currentQuery: string) => {
        setLoading(true)
        setError(null)
        try {
            const q = encodeURIComponent(currentQuery)
            if (currentTab === 'communities') {
                const res = await fetch(`${CRAWLER_URL}/api/v1/search/communities?q=${q}&limit=20`)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data: SearchResponse<CommunityHit> = await res.json()
                setCommunities(currentQuery === '' ? shuffleArray(data.hits) : data.hits)
            } else {
                const res = await fetch(`${CRAWLER_URL}/api/v1/search/users?q=${q}&limit=20`)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data: SearchResponse<UserHit> = await res.json()
                setUsers(currentQuery === '' ? shuffleArray(data.hits) : data.hits)
            }
        } catch {
            setError('検索サービスに接続できませんでした')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            fetchData(tab, query)
        }, 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [query, tab, shuffleSeed, fetchData])

    const handleShuffle = () => {
        setShuffleSeed((s) => s + 1)
    }

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
                onChange={(e) => setQuery(e.target.value)}
            />

            {error && (
                <Text variant="caption" style={{ color: 'var(--error, #f44336)' }}>
                    {error}
                </Text>
            )}

            {loading ? (
                <Text variant="caption">読み込み中...</Text>
            ) : tab === 'communities' ? (
                communities.length === 0 ? (
                    <Text variant="caption" style={{ opacity: 0.5 }}>
                        {query ? '該当するコミュニティが見つかりませんでした' : '読み込み中...'}
                    </Text>
                ) : (
                    <CommunityResultList communities={communities} />
                )
            ) : users.length === 0 ? (
                <Text variant="caption" style={{ opacity: 0.5 }}>
                    {query ? '該当するユーザーが見つかりませんでした' : '読み込み中...'}
                </Text>
            ) : (
                <UserResultList users={users} />
            )}

            {/* シャッフルボタン（空クエリ時のみ表示） */}
            {!query && !loading && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: CssVar.space(2) }}>
                    <button
                        onClick={handleShuffle}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(1),
                            padding: `${CssVar.space(2)} ${CssVar.space(4)}`,
                            borderRadius: CssVar.round(2),
                            border: `1px solid ${CssVar.divider}`,
                            backgroundColor: 'transparent',
                            color: CssVar.contentText,
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        <MdCasino size={18} />
                        シャッフル
                    </button>
                </div>
            )}
        </div>
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
                <Text
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: 0.7
                    }}
                >
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
                    <Text
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            opacity: 0.7
                        }}
                    >
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

// ─── Util ─────────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}
