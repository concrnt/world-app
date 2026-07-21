import { type CSSProperties, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Button,
    IconButton,
    List as ListView,
    ListItem,
    Popover,
    useAnchor,
    Switch,
    Tab,
    Tabs,
    Text,
    TextField
} from '@concrnt/ui'
import { MdDelete, MdMoreHoriz, MdOutlinePushPin, MdPlaylistRemove, MdPushPin } from 'react-icons/md'
import { TimelinePicker } from './TimelinePicker'
import { TimelineTag } from './TimelineTag'
import { useStack } from '../layouts/Stack'
import { TimelineView } from '../views/Timeline'
import { useClient } from '../contexts/Client'
import { useConfirm } from '../contexts/Confirm'
import { List, Schemas, Timeline } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { useSubscribe } from '../hooks/useSubscribe'

interface Props {
    uri: string
    onComplete?: () => void
}

export const ListSettings = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.listSettings' })
    const { client } = useClient()
    const confirm = useConfirm()

    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const pin = pinnedLists.find((pin) => pin.uri === props.uri)

    const [list, setList] = useState<List | null>(null)
    const [listName, setListName] = useState<string>('')
    const [postTimelines, setPostTimelines] = useState<string[]>(pin?.defaultPostTimelines ?? [])
    const [postProfile, setPostProfile] = useState<string>(pin?.defaultProfile ?? client?.currentProfile ?? 'main')
    const [excludeSelf, setExcludeSelf] = useState<boolean>(pin?.excludeSelf ?? false)

    const [menuOpen, setMenuOpen] = useState(false)
    const menuAnchor = useAnchor()

    const isPinned = pinnedLists.some((pin) => pin.uri === props.uri)

    useEffect(() => {
        if (!client) return

        client.getList(props.uri).then((data) => {
            setList(data)
            setListName(data?.title ?? '')
        })
    }, [props.uri, client])

    const saveSettings = async () => {
        if (!client || !list) return

        await client.updatePinnedList(props.uri, {
            defaultPostTimelines: postTimelines,
            defaultProfile: postProfile,
            excludeSelf
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
                            confirm.open(
                                t('confirmDeleteList'),
                                () => {
                                    client?.deleteList(props.uri).then(() => {
                                        props.onComplete?.()
                                    })
                                },
                                {
                                    description: t('confirmDeleteListDescription'),
                                    confirmText: t('deleteList')
                                }
                            )
                        }}
                    >
                        {t('deleteList')}
                    </ListItem>
                </ListView>
            </Popover>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">{t('listName')}</Text>
                <TextField value={listName} onChange={(e) => setListName(e.target.value)} />
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

            {list && (
                <Suspense fallback={<Text>Loading...</Text>}>
                    <ContainedTimelines list={list} onComplete={props.onComplete} />
                </Suspense>
            )}
        </div>
    )
}

const ContainedTimelines = (props: { list: List; onComplete?: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.listSettings' })
    const [items] = useSubscribe(props.list.items)
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
            <ResolvedTimelineList list={props.list} uris={items} filter={tab} onComplete={props.onComplete} />
        </div>
    )
}

const ResolvedTimelineList = (props: {
    list: List
    uris: string[]
    filter: 'community' | 'user'
    onComplete?: () => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.listSettings' })
    const { client } = useClient()
    const { push } = useStack()
    const [resolved, setResolved] = useState<Array<{ uri: string; timeline: Timeline | null }> | null>(null)

    useEffect(() => {
        if (!client) return
        let cancelled = false
        Promise.all(props.uris.map(async (uri) => ({ uri, timeline: await client.getTimeline(uri) }))).then((r) => {
            if (!cancelled) setResolved(r)
        })
        return () => {
            cancelled = true
        }
    }, [client, props.uris])

    if (!resolved) {
        return <Text style={{ opacity: 0.6 }}>Loading...</Text>
    }

    const targetSchema = props.filter === 'community' ? Schemas.communityTimeline : Schemas.userTimeline
    const filtered = resolved.filter(({ timeline }) => timeline?.schema === targetSchema)

    if (filtered.length === 0) {
        return <Text style={{ opacity: 0.6 }}>{t('noTimelines')}</Text>
    }

    return (
        <ListView dense>
            {filtered.map(({ uri }) => (
                <ListItem
                    key={uri}
                    style={{ borderBottom: `1px solid ${CssVar.divider}` }}
                    secondaryAction={
                        <IconButton
                            onClick={() => {
                                if (!client) return
                                props.list.removeItem(client, uri)
                            }}
                        >
                            <MdPlaylistRemove size={20} />
                        </IconButton>
                    }
                >
                    <TimelineTag
                        uri={uri}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            props.onComplete?.()
                            push(<TimelineView uri={uri} />)
                        }}
                    />
                </ListItem>
            ))}
        </ListView>
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
