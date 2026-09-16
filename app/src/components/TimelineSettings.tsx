import { Document, parseCCURI, Policy } from '@concrnt/client'
import { Schemas, Timeline } from '@concrnt/worldlib'
import { Divider, Text } from '@concrnt/ui'
import { Button, CCWallpaper, CssVar, IconButton, ListItem, Select, Tab, Tabs, TextField } from '@concrnt/ui'
import { Confirm } from './Confirm'
import { MdClear, MdMoreHoriz, MdSearch } from 'react-icons/md'
import { shareText } from '../lib/share'

import { useClient } from '../contexts/Client'
import { Fragment, Suspense, use, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { MessageContainer } from './message'
import { RenderError } from './message/RenderError'
import { MessageSkeleton } from './message/MessageSkeleton'
import { Loading } from './message/Loading'
import { useTranslation } from 'react-i18next'
import { Subscription } from './Subscription'
import { ServerChip } from './ServerChip'
import { CCEditor } from './CCEditor'
import { PolicyEditor } from './PolicyEditor'
import { useMediaProxy } from '../contexts/MediaProxy'

// cc-search(net.concrnt.search.timeline)のレスポンス。hitsは参照単位で、uriが投稿本体のcckv
interface SearchHit {
    id: string
    uri: string
    author: string
    schema: string
    createdAt: number
}

interface SearchResult {
    hits: SearchHit[]
    query: string
    limit: number
    offset: number
    estimatedTotalHits: number
}

const SEARCH_PAGE_SIZE = 10

interface Props {
    uri: string
    onDeleted?: () => void
}

export const TimelineSettings = (props: Props) => {
    const { client } = useClient()

    const timelinePromise = useMemo(() => client.getTimeline(props.uri), [client, props.uri])

    return (
        <Suspense>
            <Inner timelinePromise={timelinePromise} onDeleted={props.onDeleted} />
        </Suspense>
    )
}

interface InnerProps {
    timelinePromise: Promise<Timeline | null>
    onDeleted?: () => void
}

const Inner = (props: InnerProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.timelineSettings' })
    const { client } = useClient()
    const { getImageURL } = useMediaProxy()
    const timeline = use(props.timelinePromise)

    const [tab, setTab] = useState<'subscriptions' | 'settings'>('subscriptions')
    const [menuOpen, setMenuOpen] = useState(false)

    // 投稿検索(v1のTimelineInfo踏襲): タイムラインのホストが検索エンドポイントを広告している場合のみ有効。
    // 検索はリモートのタイムラインでもそのホストの索引に問い合わせる
    const [searchHost, setSearchHost] = useState<{ fqdn: string; available: boolean }>()
    const [searchFocused, setSearchFocused] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchedQuery, setSearchedQuery] = useState('')
    const [searchPage, setSearchPage] = useState(0)
    // 完了した要求のキー(ページ+クエリ)と結果。ローディング中かどうかは現在の要求キーとの比較で導出する
    const [searchResult, setSearchResult] = useState<{ key: string; result: SearchResult | null; error: boolean }>()

    const searchKey = searchedQuery ? `${searchPage}:${searchedQuery}` : ''
    const searchLoading = searchKey !== '' && searchResult?.key !== searchKey
    const searchError = searchKey !== '' && searchResult?.key === searchKey && searchResult.error
    // 次ページ取得中は前の結果を薄く残す
    const shownResult = searchKey !== '' ? (searchResult?.result ?? null) : null

    const timelineUri = timeline?.uri

    useEffect(() => {
        if (!timelineUri) return
        let cancelled = false
        const parsed = parseCCURI(timelineUri)
        client.api
            .resolveDomain(parsed.owner, parsed.hint)
            .then(async (fqdn) => {
                const server = await client.api.getServer(fqdn)
                if (!cancelled) setSearchHost({ fqdn, available: !!server.endpoints['net.concrnt.search.timeline'] })
            })
            .catch(() => {
                if (!cancelled) setSearchHost({ fqdn: parsed.owner, available: false })
            })
        return () => {
            cancelled = true
        }
    }, [client, timelineUri])

    useEffect(() => {
        if (!timelineUri || !searchHost?.available || !searchKey) return
        let cancelled = false
        client.api
            .requestConcrntApi<SearchResult>(searchHost.fqdn, 'net.concrnt.search.timeline', {
                uri: timelineUri,
                q: searchedQuery,
                limit: String(SEARCH_PAGE_SIZE),
                offset: String(searchPage * SEARCH_PAGE_SIZE)
            })
            .then((result) => {
                if (!cancelled) setSearchResult({ key: searchKey, result, error: false })
            })
            .catch((e) => {
                if (cancelled) return
                console.error('timeline search failed', e)
                setSearchResult({ key: searchKey, result: null, error: true })
            })
        return () => {
            cancelled = true
        }
    }, [client, timelineUri, searchHost, searchKey, searchedQuery, searchPage])

    const submitSearch = () => {
        const query = searchQuery.trim()
        setSearchPage(0)
        setSearchedQuery(query)
    }

    const clearSearch = () => {
        setSearchQuery('')
        setSearchedQuery('')
        setSearchPage(0)
        setSearchResult(undefined)
        setSearchFocused(false)
    }

    if (!timeline) {
        return <>Timeline not found.</>
    }

    const isMe = client.ccid === timeline.author

    // シェア用URLはデプロイ先ホストに関わらずconcrnt.world固定(OGP対応がconcrnt.worldのみのため)
    const shareURL = 'https://concrnt.world/timeline/' + encodeURIComponent(timeline.uri)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                width: '100%'
            }}
        >
            <CCWallpaper src={getImageURL(timeline.banner)}>
                <div
                    style={{
                        padding: CssVar.space(2)
                    }}
                >
                    <div
                        style={{
                            backgroundColor: CssVar.contentBackground,
                            padding: CssVar.space(2),
                            borderRadius: CssVar.space(1)
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(2)
                            }}
                        >
                            <Text variant="h2">{timeline.name}</Text>
                            <div style={{ flex: 1 }} />
                            <IconButton onClick={() => setMenuOpen(true)}>
                                <MdMoreHoriz size={24} />
                            </IconButton>
                        </div>
                        <div
                            style={{
                                marginTop: CssVar.space(1),
                                marginBottom: CssVar.space(1)
                            }}
                        >
                            <ServerChip uri={timeline.uri} />
                        </div>
                        <Text>{timeline.description}</Text>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(1),
                                marginTop: CssVar.space(2)
                            }}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                        >
                            <TextField
                                value={searchQuery}
                                disabled={!searchHost?.available}
                                placeholder={
                                    searchHost && !searchHost.available
                                        ? t('searchNotAvailable', { host: searchHost.fqdn })
                                        : t('search')
                                }
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    // 日本語入力の確定Enterでは検索しない
                                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitSearch()
                                }}
                            />
                            {searchQuery && (
                                <IconButton onClick={clearSearch} title={t('clearSearch')}>
                                    <MdClear size={20} />
                                </IconButton>
                            )}
                            <IconButton disabled={!searchHost?.available} onClick={submitSearch} title={t('search')}>
                                <MdSearch size={20} />
                            </IconButton>
                        </div>
                    </div>
                </div>
            </CCWallpaper>
            <Select
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                options={[
                    <ListItem
                        key="share"
                        onClick={() => {
                            shareText(shareURL, timeline.name).catch(() => {})
                            setMenuOpen(false)
                        }}
                    >
                        <Text>{t('share')}</Text>
                    </ListItem>
                ]}
            />
            {searchFocused || searchedQuery ? (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2),
                        padding: CssVar.space(2)
                    }}
                >
                    {searchError ? (
                        <Text variant="caption">{t('searchFailed')}</Text>
                    ) : shownResult === null ? (
                        searchLoading ? (
                            <Loading message={t('searching')} />
                        ) : (
                            <Text variant="caption">{t('searchResultPlaceholder')}</Text>
                        )
                    ) : shownResult.hits.length === 0 ? (
                        <Text>{t('searchResultEmpty')}</Text>
                    ) : (
                        <>
                            <Text variant="h3">{t('searchResultTitle', { query: shownResult.query })}</Text>
                            {/* QueryTimelineの行構造(gap 8px+Divider)に合わせる。次ページ取得中は前ページを薄く残す */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    opacity: searchLoading ? 0.6 : 1,
                                    transition: 'opacity 0.2s'
                                }}
                            >
                                <Divider />
                                {shownResult.hits.map((hit) => (
                                    <Fragment key={hit.id}>
                                        <ErrorBoundary FallbackComponent={RenderError}>
                                            <Suspense fallback={<MessageSkeleton />}>
                                                <MessageContainer uri={hit.uri} hint={searchHost?.fqdn} />
                                            </Suspense>
                                        </ErrorBoundary>
                                        <Divider />
                                    </Fragment>
                                ))}
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <Button
                                    variant="text"
                                    disabled={searchPage === 0 || searchLoading}
                                    onClick={() => setSearchPage((p) => p - 1)}
                                >
                                    {t('prev')}
                                </Button>
                                <Text>{searchPage + 1}</Text>
                                <Button
                                    variant="text"
                                    disabled={
                                        shownResult.offset + shownResult.hits.length >=
                                            shownResult.estimatedTotalHits || searchLoading
                                    }
                                    onClick={() => setSearchPage((p) => p + 1)}
                                >
                                    {t('next')}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <>
                    <Tabs>
                        <Tab
                            selected={tab === 'subscriptions'}
                            onClick={() => setTab('subscriptions')}
                            groupId="timeline-settings"
                            style={{
                                color: CssVar.contentText
                            }}
                        >
                            <Text>Subscriptions</Text>
                        </Tab>
                        {isMe && (
                            <Tab
                                selected={tab === 'settings'}
                                onClick={() => setTab('settings')}
                                groupId="timeline-settings"
                                style={{
                                    color: CssVar.contentText
                                }}
                            >
                                <Text>Settings</Text>
                            </Tab>
                        )}
                    </Tabs>
                    <div
                        style={{
                            padding: CssVar.space(2)
                        }}
                    >
                        {tab === 'subscriptions' && <Subscription target={timeline.uri} />}
                        {tab === 'settings' && <TimelineEditor timeline={timeline} onDeleted={props.onDeleted} />}
                    </div>
                </>
            )}
        </div>
    )
}

interface EditorProps {
    timeline: Timeline
    onDeleted?: () => void
}

const TimelineEditor = (props: EditorProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.timelineSettings' })
    const { client } = useClient()
    const [schemaDraft, setSchemaDraft] = useState<string>()
    const [valueDraft, setValueDraft] = useState<any>()
    const [policyDraft, setPolicyDraft] = useState<Policy>()
    const [key, setKey] = useState<string>()
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

    useEffect(() => {
        client.api
            .getDocument<any>(props.timeline.uri)
            .then((timeline) => {
                if (!timeline) throw new Error('Timeline document not found')
                setKey(timeline.key)
                setValueDraft(timeline.value)
                setSchemaDraft(timeline.schema)
                setPolicyDraft(timeline.policy)
            })
            .catch((e) => {
                console.error(e)
                setKey(undefined)
                setValueDraft(undefined)
                setSchemaDraft(undefined)
                setPolicyDraft(undefined)
            })
    }, [props.timeline])

    const handleSave = () => {
        if (!key || !schemaDraft) return
        const document: Document<any> = {
            kind: 'record',
            key: key,
            schema: schemaDraft,
            value: valueDraft,
            author: client.ccid,
            createdAt: new Date(),
            policy: policyDraft
        }
        client.api.commit(document)
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4)
            }}
        >
            <Text variant="h3">{t('schema')}</Text>
            <TextField
                // error={!schemaDraft?.startsWith('https://')}
                // helperText={t('schemaDesc')}
                value={schemaDraft}
                onChange={(e) => {
                    setSchemaDraft(e.target.value)
                }}
            />
            <div>
                <Text variant="h3">{t('attributes')}</Text>
                <CCEditor
                    schemaURL={schemaDraft}
                    value={valueDraft}
                    setValue={(e) => {
                        setValueDraft(e)
                    }}
                />
            </div>
            <Text variant="h3">Policy</Text>
            <PolicyEditor policy={policyDraft} setPolicy={setPolicyDraft} />

            <Button onClick={handleSave}>Save</Button>

            {/* homeタイムライン等を誤って消せないよう、削除はコミュニティタイムラインに限定する */}
            {props.timeline.schema === Schemas.communityTimeline && (
                <Button variant="outlined" onClick={() => setDeleteConfirmOpen(true)}>
                    {t('deleteTimeline')}
                </Button>
            )}
            <Confirm
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                title={t('confirmDeleteTimeline')}
                description={t('confirmDeleteTimelineDescription')}
                confirmText={t('deleteTimeline')}
                onConfirm={() => {
                    client.api.delete(props.timeline.uri).then(() => {
                        client.knownCommunities.reload()
                        props.onDeleted?.()
                    })
                }}
            />
        </div>
    )
}
