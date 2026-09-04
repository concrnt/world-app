import { type CSSProperties, Suspense, use, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Avatar,
    Button,
    CCImage,
    Confirm,
    IconButton,
    List as ListView,
    ListItem,
    Popover,
    useAnchor,
    Skeleton,
    Switch,
    Tab,
    Tabs,
    Text,
    TextField
} from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import {
    MdClose,
    MdDelete,
    MdMoreHoriz,
    MdOutlineEmojiEmotions,
    MdOutlinePushPin,
    MdPlaylistRemove,
    MdPushPin
} from 'react-icons/md'
import { TimelinePicker } from './TimelinePicker'
import { TimelineTag } from './TimelineTag'
import { useClient } from '../contexts/Client'
import { useEmojiPicker } from '../contexts/EmojiPicker'
import { List, type ListEntry, ListSchema, type ProfileSchema, Schemas, semantics, Timeline } from '@concrnt/worldlib'
import { Document } from '@concrnt/client'
import { CssVar } from '../types/Theme'
import { useSubscribe } from '../hooks/useSubscribe'

interface Props {
    uri: string
    onComplete?: () => void
    onEntriesChanged?: () => void
}

export const ListSettings = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.listSettings' })
    const { client } = useClient()

    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const pin = pinnedLists.find((pin) => pin.uri === props.uri)

    const emojiPicker = useEmojiPicker()

    const [list, setList] = useState<List | null>(null)
    const [listName, setListName] = useState<string>('')
    const [iconURL, setIconURL] = useState<string>('')
    const [postTimelines, setPostTimelines] = useState<string[]>(pin?.defaultPostTimelines ?? [])
    const [postProfile, setPostProfile] = useState<string>(pin?.defaultProfile ?? client?.currentProfile ?? 'main')
    const [excludeSelf, setExcludeSelf] = useState<boolean>(pin?.excludeSelf ?? false)
    const [isIconTab, setIsIconTab] = useState<boolean>(pin?.isIconTab ?? false)

    const [menuOpen, setMenuOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const menuAnchor = useAnchor()
    const emojiPickerAnchor = useAnchor()

    const isPinned = pinnedLists.some((pin) => pin.uri === props.uri)

    useEffect(() => {
        if (!client) return

        client.getList(props.uri).then((data) => {
            setList(data)
            setListName(data?.title ?? '')
            setIconURL(data?.iconURL ?? '')
        })
    }, [props.uri, client])

    const saveSettings = async () => {
        if (!client || !list) return

        const latest = await client.api.getDocument<ListSchema>(props.uri)
        const document: Document<ListSchema> = {
            kind: 'record',
            key: props.uri,
            schema: Schemas.list,
            value: {
                ...latest.value,
                name: listName,
                iconURL: iconURL || undefined
            },
            author: client.ccid,
            createdAt: new Date()
        }
        await client.api.commit(document)

        await client.updatePinnedList(props.uri, {
            defaultPostTimelines: postTimelines,
            defaultProfile: postProfile,
            excludeSelf,
            isIconTab
        })

        props.onComplete?.()
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                width: '100%',
                padding: CssVar.space(2)
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Text variant="h3">{t('title')}</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                    <IconButton onClick={() => setMenuOpen(true)} style={{ anchorName: menuAnchor } as CSSProperties}>
                        <MdMoreHoriz size={20} />
                    </IconButton>
                    <Button onClick={saveSettings} busyChildren={t('saving')}>
                        {t('save')}
                    </Button>
                </div>
            </div>

            <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchor={menuAnchor}>
                <ListView dense disablePadding style={{ minWidth: '180px' }}>
                    <ListItem
                        icon={isPinned ? <MdOutlinePushPin size={20} /> : <MdPushPin size={20} />}
                        onClick={() => {
                            setMenuOpen(false)
                            if (isPinned) {
                                client?.removePin(props.uri)
                            } else {
                                client?.addPin(props.uri)
                            }
                        }}
                    >
                        {isPinned ? t('unpin') : t('pin')}
                    </ListItem>
                    <ListItem
                        icon={<MdDelete size={20} />}
                        onClick={() => {
                            setMenuOpen(false)
                            setDeleteConfirmOpen(true)
                        }}
                    >
                        {t('deleteList')}
                    </ListItem>
                </ListView>
            </Popover>
            <Confirm
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                title={t('confirmDeleteList')}
                onConfirm={() => {
                    client?.deleteList(props.uri).then(() => {
                        props.onComplete?.()
                    })
                }}
                description={t('confirmDeleteListDescription')}
                confirmText={t('deleteList')}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">{t('listName')}</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(2) }}>
                    <IconButton
                        style={{ anchorName: emojiPickerAnchor } as React.CSSProperties}
                        onClick={() => {
                            emojiPicker.open((emoji) => {
                                setIconURL(emoji.imageURL)
                                emojiPicker.close()
                            }, emojiPickerAnchor)
                        }}
                    >
                        {iconURL ? (
                            <CCImage
                                src={iconURL}
                                maxHeight={128}
                                alt=""
                                style={{
                                    height: 'calc(1.125rem * 1.6)'
                                }}
                            />
                        ) : (
                            <MdOutlineEmojiEmotions size={20} />
                        )}
                    </IconButton>
                    {iconURL && (
                        <IconButton onClick={() => setIconURL('')}>
                            <MdClose size={20} />
                        </IconButton>
                    )}
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <TextField value={listName} onChange={(e) => setListName(e.target.value)} />
                    </div>
                </div>
            </div>
            {isPinned && (
                <Suspense fallback={<Text>Loading...</Text>}>
                    <DefaultPostTimelines
                        selected={postTimelines}
                        setSelected={setPostTimelines}
                        selectedProfile={postProfile}
                        setSelectedProfile={setPostProfile}
                    />
                </Suspense>
            )}
            {isPinned && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <Text variant="h5">{t('excludeSelf')}</Text>
                    <Switch checked={excludeSelf} onChange={setExcludeSelf} />
                </div>
            )}
            {isPinned && iconURL && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <Text variant="h5">{t('isIconTab')}</Text>
                    <Switch checked={isIconTab} onChange={setIsIconTab} />
                </div>
            )}

            {list && (
                <Suspense fallback={<Text>Loading...</Text>}>
                    <ContainedTimelines
                        list={list}
                        onComplete={props.onComplete}
                        onEntriesChanged={props.onEntriesChanged}
                    />
                </Suspense>
            )}
        </div>
    )
}

const ContainedTimelines = (props: { list: List; onComplete?: () => void; onEntriesChanged?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.listSettings' })
    const [entries] = useSubscribe(props.list.entries)
    const [tab, setTab] = useState<'community' | 'user'>('community')

    const activeColor = CssVar.contentLink
    const inactiveColor = `rgb(from ${CssVar.contentText} r g b / 0.35)`
    const tabStyle = (selected: boolean) => ({
        color: selected ? activeColor : inactiveColor,
        fontWeight: selected ? ('bold' as const) : ('normal' as const)
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <Text variant="h5">{t('containedTimelines')}</Text>
            <Tabs>
                <Tab
                    selected={tab === 'community'}
                    groupId="list-settings-timelines"
                    style={tabStyle(tab === 'community')}
                    onClick={() => setTab('community')}
                >
                    <Text>{t('community')}</Text>
                </Tab>
                <Tab
                    selected={tab === 'user'}
                    groupId="list-settings-timelines"
                    style={tabStyle(tab === 'user')}
                    onClick={() => setTab('user')}
                >
                    <Text>{t('user')}</Text>
                </Tab>
            </Tabs>
            <ResolvedTimelineList
                list={props.list}
                entries={entries}
                filter={tab}
                onComplete={props.onComplete}
                onEntriesChanged={props.onEntriesChanged}
            />
        </div>
    )
}

const ResolvedTimelineList = (props: {
    list: List
    entries: ListEntry[]
    filter: 'community' | 'user'
    onComplete?: () => void
    onEntriesChanged?: () => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.listSettings' })
    const { client } = useClient()
    const navigate = useNavigate()

    const targetSchema = props.filter === 'community' ? Schemas.communityTimeline : Schemas.userTimeline
    const filtered = props.entries.filter((entry) => entry.value?.href && entry.value?.schema === targetSchema)

    if (filtered.length === 0) {
        return <Text style={{ opacity: 0.6 }}>{t('noTimelines')}</Text>
    }

    return (
        <ListView dense>
            {filtered.map((entry) => (
                <ListItem
                    key={entry.key}
                    style={{ borderBottom: `1px solid ${CssVar.divider}` }}
                    secondaryAction={
                        <IconButton
                            onClick={() => {
                                if (!client) return
                                props.list.removeItem(client, entry.value.href).then(() => props.onEntriesChanged?.())
                            }}
                        >
                            <MdPlaylistRemove size={20} />
                        </IconButton>
                    }
                >
                    {props.filter === 'community' ? (
                        <TimelineTag
                            uri={entry.value.href}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                                props.onComplete?.()
                                navigate('/timeline/' + encodeURIComponent(entry.value.href))
                            }}
                        />
                    ) : (
                        <UserTimelineItem
                            uri={entry.value.href}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                                props.onComplete?.()
                                navigate('/profile/' + entry.value.href.split('/')[2])
                            }}
                        />
                    )}
                </ListItem>
            ))}
        </ListView>
    )
}

const UserTimelineItem = (props: { uri: string; onClick?: (e: React.MouseEvent) => void; style?: CSSProperties }) => {
    const { client } = useClient()

    // cckv://<ccid>/concrnt.world/profiles/<profile>/home-timeline
    const ccid = props.uri.split('/')[2]
    const profileName = props.uri.split('/')[5]

    const profilePromise = useMemo(() => {
        if (!client) return Promise.resolve<Partial<ProfileSchema>>({})
        return Promise.all([
            client.getUser(ccid),
            client.api.getDocument<ProfileSchema>(semantics.profile(ccid, profileName)).catch(() => null)
        ]).then(([user, doc]) => ({ ...user?.profile, ...doc?.value }))
    }, [client, ccid, profileName])

    return (
        <Suspense fallback={<Skeleton height={'1rem'} width={'3rem'} />}>
            <UserTimelineItemInner
                ccid={ccid}
                profilePromise={profilePromise}
                onClick={props.onClick}
                style={props.style}
            />
        </Suspense>
    )
}

const UserTimelineItemInner = (props: {
    ccid: string
    profilePromise: Promise<Partial<ProfileSchema>>
    onClick?: (e: React.MouseEvent) => void
    style?: CSSProperties
}) => {
    const profile = use(props.profilePromise)

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
            }}
            onClick={props.onClick}
        >
            <Avatar ccid={props.ccid} src={profile.avatar} style={{ width: 20, height: 20 }} />
            <Text style={props.style}>{profile.username ?? 'anonymous'}</Text>
        </span>
    )
}

const DefaultPostTimelines = (props: {
    selected: string[]
    setSelected: (timelines: string[]) => void
    selectedProfile: string
    setSelectedProfile: (profile: string) => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.listSettings' })
    const { client } = useClient()
    const [knownCommunities] = useSubscribe(client.knownCommunities)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <Text variant="h5">{t('defaultPostTimelines')}</Text>
            <TimelinePicker
                items={knownCommunities}
                selected={props.selected}
                setSelected={props.setSelected}
                keyFunc={(item: Timeline) => item.uri}
                labelFunc={(item: Timeline) => item.name}
                selectedProfile={props.selectedProfile}
                setSelectedProfile={props.setSelectedProfile}
            />
        </div>
    )
}
