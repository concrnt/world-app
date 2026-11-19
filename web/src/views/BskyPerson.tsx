import { Avatar, Button, CCWallpaper, CssVar, useTheme, Text, Divider } from '@concrnt/ui'
import { View } from '../components/View'
import { useNavigation } from '../contexts/Navigation'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { NotFoundError, Document } from '@concrnt/client'
import { Schemas, AtprotoFollowSchema } from '@concrnt/worldlib'
import { BskyAuthorFeed, BskyFeedItem, BskyProfile, bskyProfileUrl, followKey } from '../utils/bluesky'
import { BlueskyRecord } from '../components/message/BlueskyRecord'
import { MessageSkeleton } from '../components/message/MessageSkeleton'
import { MdRepeat } from 'react-icons/md'

interface Props {
    person: BskyProfile
}

export const BskyPerson = ({ person }: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.bskyPerson' })
    const theme = useTheme()
    const navigation = useNavigation()
    const { client } = useClient()

    const [followed, setFollowed] = useState<boolean | undefined>(undefined)

    // 旧ブリッジ(authorFeed未提供)では一覧ブロックごと出さずヘッダだけ
    const feedSupported = 'world.concrnt.atproto.authorFeed' in (client.server?.endpoints ?? {})

    const [items, setItems] = useState<BskyFeedItem[]>([])
    const [cursor, setCursor] = useState<string | null>(null)
    const [feedState, setFeedState] = useState<'loading' | 'done' | 'error'>('loading')
    const loadingRef = useRef(false)
    // person切替中に旧ロードの結果が新しい表示へ混入しないよう世代番号で捨てる
    const sessionRef = useRef(0)
    const scrollRef = useRef<HTMLDivElement>(null)

    const updateFollowed = () => {
        client.api
            .getDocument(followKey(client.ccid, person.did))
            .then(() => {
                setFollowed(true)
            })
            .catch((err) => {
                if (err instanceof NotFoundError) {
                    setFollowed(false)
                } else {
                    console.log(err)
                }
            })
    }

    // 投稿一覧はブリッジのauthorFeed(appviewのgetAuthorFeedプロキシ)をカーソルで辿る。
    // APのoutboxと違い各行のpost viewが一覧に同梱されるので、BlueskyRecordにそのまま渡して再resolveしない。
    const loadPosts = async (from: string | null, initial: boolean) => {
        if (loadingRef.current) return
        loadingRef.current = true
        const session = sessionRef.current
        try {
            const res = await client.api.callConcrntApi<BskyAuthorFeed>(
                client.server.domain,
                'world.concrnt.atproto.authorFeed',
                { actor: person.did, ...(from ? { cursor: from } : {}) }
            )
            if (sessionRef.current !== session) return
            // ピン留め(reasonPin)はAPのfeatured同様に扱わない(要求もしていないが防御的に読み飛ばす)
            const collected = (res.feed ?? []).filter(
                (item) => item.post?.uri && item.reason?.$type !== 'app.bsky.feed.defs#reasonPin'
            )
            setItems((prev) => [...prev, ...collected])
            setCursor(res.cursor ?? null)
            setFeedState('done')
        } catch (err) {
            if (sessionRef.current === session) {
                console.log(err)
                setFeedState(initial ? 'error' : 'done')
                setCursor(null)
            }
        } finally {
            loadingRef.current = false
        }
    }

    useEffect(() => {
        updateFollowed()
        sessionRef.current++
        loadingRef.current = false
        setItems([])
        setCursor(null)
        if (feedSupported) {
            setFeedState('loading')
            loadPosts(null, true)
        } else {
            setFeedState('done')
        }
    }, [person.did])

    // 投稿は折りたたまれるため1ページでコンテナが埋まらないことがあり、
    // その場合スクロールイベントが発生せず次ページが永遠に読まれない。埋まるまで追い読みする。
    useEffect(() => {
        const el = scrollRef.current
        if (!el || !cursor || loadingRef.current) return
        if (el.scrollHeight - el.clientHeight < 500) {
            loadPosts(cursor, false)
        }
    }, [items, cursor])

    return (
        <View>
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto'
                }}
                onScroll={(e) => {
                    const el = e.currentTarget
                    if (el.scrollHeight - el.scrollTop - el.clientHeight < 500 && cursor && !loadingRef.current) {
                        loadPosts(cursor, false)
                    }
                }}
            >
                <div
                    style={{
                        position: 'relative'
                    }}
                >
                    <CCWallpaper
                        style={{
                            paddingTop: theme.variant === 'classic' ? 'env(safe-area-inset-top)' : undefined,
                            height: '150px'
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: CssVar.space(1),
                                gap: CssVar.space(1)
                            }}
                        >
                            <div
                                style={{
                                    color: theme.variant === 'classic' ? CssVar.backdropText : CssVar.uiText,
                                    height: '40px',
                                    width: '40px'
                                }}
                            >
                                {navigation.backNode}
                            </div>
                            <div style={{ flex: 1 }} />
                        </div>
                    </CCWallpaper>
                    <Avatar
                        ccid={person.did}
                        style={{
                            width: `100px`,
                            height: `100px`,
                            position: 'absolute',
                            transform: 'translateY(-50%)',
                            left: CssVar.space(2)
                        }}
                        src={person.avatar}
                    />
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2),
                            padding: `0 ${CssVar.space(2)}`
                        }}
                    >
                        <div
                            style={{
                                minHeight: `50px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end'
                            }}
                        >
                            {followed !== undefined &&
                                (followed ? (
                                    <Button
                                        onClick={() => {
                                            client.api
                                                .delete(followKey(client.ccid, person.did))
                                                .then(() => {
                                                    setFollowed(false)
                                                })
                                                .catch((err) => {
                                                    console.log(err)
                                                })
                                        }}
                                    >
                                        {t('unfollow')}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => {
                                            const document: Document<AtprotoFollowSchema> = {
                                                kind: 'record',
                                                key: followKey(client.ccid, person.did),
                                                author: client.ccid,
                                                schema: Schemas.atprotoFollow,
                                                value: {
                                                    did: person.did
                                                },
                                                createdAt: new Date()
                                            }
                                            client.api
                                                .commit(document)
                                                .then(() => {
                                                    setFollowed(true)
                                                })
                                                .catch((err) => {
                                                    console.log(err)
                                                })
                                        }}
                                    >
                                        {t('follow')}
                                    </Button>
                                ))}
                        </div>
                        <div>
                            <Text
                                variant="h6"
                                style={{
                                    fontWeight: 'bold',
                                    fontSize: '1.2rem'
                                }}
                            >
                                {person.displayName || person.handle}
                            </Text>
                            <Text>@{person.handle}</Text>
                        </div>
                        <div>
                            <Text>{person.description || t('noDescription')}</Text>
                        </div>
                    </div>
                </div>
                <div>
                    <Text>{t('bskyUserNotice')}</Text>
                    <Button
                        onClick={() => {
                            window.open(bskyProfileUrl(person.handle || person.did), '_blank', 'noopener,noreferrer')
                        }}
                    >
                        {t('openRemote')}
                    </Button>
                </div>
                {/* QueryTimelineの行構造(gap 8px+行のpadding 0 space(2)+Divider)に合わせる */}
                {feedSupported && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Divider />
                        {items.map((item, i) => (
                            <Fragment key={`${i}:${item.post.uri}`}>
                                <div style={{ padding: `0 ${CssVar.space(2)}` }}>
                                    {item.reason?.$type === 'app.bsky.feed.defs#reasonRepost' && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: CssVar.space(1),
                                                opacity: 0.7
                                            }}
                                        >
                                            <MdRepeat size={14} />
                                            <Text variant="caption">
                                                {t('reposted', { name: person.displayName || person.handle })}
                                            </Text>
                                        </div>
                                    )}
                                    <BlueskyRecord atUri={item.post.uri} post={item.post} />
                                </div>
                                <Divider />
                            </Fragment>
                        ))}
                        {feedState === 'loading' && (
                            <div style={{ padding: `0 ${CssVar.space(2)}` }}>
                                <MessageSkeleton />
                            </div>
                        )}
                        {feedState === 'done' && items.length === 0 && (
                            <Text style={{ padding: CssVar.space(2), opacity: 0.7 }}>{t('noPosts')}</Text>
                        )}
                        {feedState === 'error' && (
                            <Text style={{ padding: CssVar.space(2), opacity: 0.7 }}>{t('loadFailed')}</Text>
                        )}
                    </div>
                )}
            </div>
        </View>
    )
}
