import {
    Avatar,
    Button,
    CCWallpaper,
    CssVar,
    useTheme,
    View,
    Text,
    Divider,
    GfmRenderer,
    MfmRenderer,
    type EmojiLite
} from '@concrnt/ui'
import { useNavigation } from '../contexts/Navigation'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { NotFoundError, Document } from '@concrnt/client'
import { Schemas, ApFollowSchema } from '@concrnt/worldlib'
import { ApObject, apFollowKey, resolveApObject } from '../utils/activitypub'
import { useMediaProxy } from '../contexts/MediaProxy'
import { ActivitypubNote } from '../components/message/ActivitypubNote'
import { MessageSkeleton } from '../components/message/MessageSkeleton'
import { MdRepeat } from 'react-icons/md'

interface Props {
    person: ApObject
}

interface OutboxItem {
    noteURL: string
    actorURL?: string
    boost: boolean
}

export const ApPerson = ({ person }: Props) => {
    const { getImageURL } = useMediaProxy()
    const { t } = useTranslation('', { keyPrefix: 'views.apPerson' })
    const theme = useTheme()
    const navigation = useNavigation()
    const { client } = useClient()

    const [followed, setFollowed] = useState<boolean | undefined>(undefined)

    const [items, setItems] = useState<OutboxItem[]>([])
    const [next, setNext] = useState<string | null>(null)
    const [outboxState, setOutboxState] = useState<'loading' | 'done' | 'error'>('loading')
    const loadingRef = useRef(false)
    // person切替中に旧ロードの結果が新しい表示へ混入しないよう世代番号で捨てる
    const sessionRef = useRef(0)
    const scrollRef = useRef<HTMLDivElement>(null)

    const updateFollowed = () => {
        client.api
            .getDocument(apFollowKey(client.ccid, person.id))
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

    // outboxはインデックスとしてだけ読み、各投稿の解決/描画はActivitypubNoteに任せる。
    // ページ取得はno-cache(SWRの既定だと開いた時点の新着が見えない)、ノート側は既定TTLのまま。
    const loadPosts = async (uri: string, initial: boolean) => {
        if (loadingRef.current) return
        loadingRef.current = true
        const session = sessionRef.current
        try {
            let page = await resolveApObject(client, uri, { cache: 'no-cache' })
            // Mastodon/Misskeyのoutboxルートはitemsを持たずfirstだけのOrderedCollection
            if (page && page.getItems().length === 0 && page.first) {
                page =
                    typeof page.first === 'string'
                        ? await resolveApObject(client, page.first, { cache: 'no-cache' })
                        : new ApObject(page.first)
            }
            if (sessionRef.current !== session) return
            if (!page) {
                setOutboxState(initial ? 'error' : 'done')
                setNext(null)
                return
            }
            const collected: OutboxItem[] = []
            for (const entry of page.getItems()) {
                // URL文字列だけのentryは1件ずつの追加resolveに見合わないのでスキップ
                if (typeof entry === 'string') continue
                const obj = entry.object
                if (entry.type === 'Create') {
                    // Createはプロフィール主自身の投稿なのでactorはpersonへ倒せる
                    if (typeof obj === 'string') collected.push({ noteURL: obj, actorURL: person.id, boost: false })
                    else if (obj?.id) {
                        collected.push({ noteURL: obj.id, actorURL: obj.attributedTo ?? person.id, boost: false })
                    }
                } else if (entry.type === 'Announce') {
                    // 裸URLのAnnounceは元投稿者不明のまま渡し、ActivitypubNote側でattributedToから解決させる
                    if (typeof obj === 'string') collected.push({ noteURL: obj, boost: true })
                    else if (obj?.id) collected.push({ noteURL: obj.id, actorURL: obj.attributedTo, boost: true })
                }
            }
            setItems((prev) => [...prev, ...collected])
            setNext(typeof page.next === 'string' ? page.next : (page.next?.id ?? null))
            setOutboxState('done')
        } catch (err) {
            if (sessionRef.current === session) {
                console.log(err)
                setOutboxState(initial ? 'error' : 'done')
                setNext(null)
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
        setNext(null)
        if (person.outbox) {
            setOutboxState('loading')
            loadPosts(person.outbox, true)
        } else {
            setOutboxState('done')
        }
    }, [person.id])

    // 投稿は折りたたまれるため1ページでコンテナが埋まらないことがあり、
    // その場合スクロールイベントが発生せず次ページが永遠に読まれない。埋まるまで追い読みする。
    useEffect(() => {
        const el = scrollRef.current
        if (!el || !next || loadingRef.current) return
        if (el.scrollHeight - el.clientHeight < 500) {
            loadPosts(next, false)
        }
    }, [items, next])

    const emojiDict: Record<string, EmojiLite> = {}
    for (const tag of person.getTags()) {
        if (tag.type !== 'Emoji' || !tag.name) continue
        const icon = Array.isArray(tag.icon) ? tag.icon[0] : tag.icon
        if (icon?.url) emojiDict[tag.name.replace(/:/g, '')] = { imageURL: icon.url }
    }

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
                    if (el.scrollHeight - el.scrollTop - el.clientHeight < 500 && next && !loadingRef.current) {
                        loadPosts(next, false)
                    }
                }}
            >
                <div
                    style={{
                        position: 'relative'
                    }}
                >
                    <CCWallpaper
                        src={getImageURL(person.getImages()[0]?.url)}
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
                        ccid={person.id?.toString() ?? ''}
                        style={{
                            width: `100px`,
                            height: `100px`,
                            position: 'absolute',
                            transform: 'translateY(-50%)',
                            left: CssVar.space(2)
                        }}
                        src={person.getIcons()[0]?.url}
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
                                                .delete(apFollowKey(client.ccid, person.id))
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
                                            const document: Document<ApFollowSchema> = {
                                                kind: 'record',
                                                key: apFollowKey(client.ccid, person.id),
                                                author: client.ccid,
                                                schema: Schemas.apFollow,
                                                value: {
                                                    actorURI: person.id
                                                },
                                                createdAt: new Date(),
                                                onUpdate: 'forget'
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
                                {person.name || 'Anonymous'}
                            </Text>
                            <Text>
                                @{person.preferredUsername}@{new URL(person.id).host ?? 'unknown'}
                            </Text>
                        </div>
                        <div>
                            {person.summary ? (
                                person._misskey_summary ? (
                                    <MfmRenderer messagebody={person._misskey_summary} emojiDict={emojiDict} />
                                ) : (
                                    <GfmRenderer messagebody={person.summary} emojiDict={emojiDict} />
                                )
                            ) : (
                                <Text>{t('noDescription')}</Text>
                            )}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: CssVar.space(2)
                            }}
                        ></div>
                    </div>
                </div>
                <div>
                    <Text>{t('apUserNotice')}</Text>
                    {person.url && (
                        <Button
                            onClick={() => {
                                openUrl(person.url!.toString(), 'inAppBrowser')
                            }}
                        >
                            {t('openRemote')}
                        </Button>
                    )}
                </div>
                {/* QueryTimelineの行構造(gap 8px+行のpadding 0 space(2)+Divider)に合わせる */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Divider />
                    {items.map((item, i) => (
                        <Fragment key={`${i}:${item.noteURL}`}>
                            <div style={{ padding: `0 ${CssVar.space(2)}` }}>
                                {item.boost && (
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
                                            {t('boosted', {
                                                name: person.name || person.preferredUsername || 'Anonymous'
                                            })}
                                        </Text>
                                    </div>
                                )}
                                <ActivitypubNote actorURL={item.actorURL} noteURL={item.noteURL} />
                            </div>
                            <Divider />
                        </Fragment>
                    ))}
                    {outboxState === 'loading' && (
                        <div style={{ padding: `0 ${CssVar.space(2)}` }}>
                            <MessageSkeleton />
                        </div>
                    )}
                    {outboxState === 'done' && items.length === 0 && (
                        <Text style={{ padding: CssVar.space(2), opacity: 0.7 }}>{t('noPosts')}</Text>
                    )}
                    {outboxState === 'error' && (
                        <Text style={{ padding: CssVar.space(2), opacity: 0.7 }}>{t('loadFailed')}</Text>
                    )}
                </div>
            </div>
        </View>
    )
}
