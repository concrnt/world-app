import { Suspense, use, useMemo, useState } from 'react'
import { Reorder, useDragControls, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Header } from '../ui/Header'
import { View, Text, IconButton, Button, Checkbox, TextField, CCImage } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { List as ListType, ListSchema, Schemas, semantics } from '@concrnt/worldlib'
import { Document } from '@concrnt/client'
import { MdPlaylistAdd, MdDragHandle, MdTune } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { ListView } from './List'

import { RiPushpinFill } from 'react-icons/ri'
import { RiPushpinLine } from 'react-icons/ri'
import { ListSettings } from '../components/ListSettings'
import { Drawer } from '../ui/Drawer'
import { FAB } from '../ui/FAB'
import { CssVar } from '../types/Theme'
import { useSubscribe } from '../hooks/useSubscribe'
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'

export const ListsView = () => {
    const { client } = useClient()

    const [creatorOpen, setCreatorOpen] = useState(false)
    const [creatorBusy, setCreatorBusy] = useState(false)
    const [settingsTarget, setSettingsTarget] = useState<string | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)

    const [updater, setUpdater] = useState(0)
    const listsPromise = useMemo(() => {
        if (!client) return Promise.resolve([])
        const p = client.getLists()
        p.then((lists) => {
            console.log('Fetched lists:', lists)
        })
        return p
    }, [client, updater])

    return (
        <>
            <View>
                <Header>Lists</Header>
                <motion.div
                    layoutScroll
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto'
                    }}
                >
                    <Suspense fallback={<Text>Loading...</Text>}>
                        <Lists
                            listsPromise={listsPromise}
                            onOpenSettings={(uri) => {
                                setSettingsTarget(uri)
                                setSettingsOpen(true)
                            }}
                        />
                    </Suspense>
                </motion.div>
            </View>
            <FAB
                onClick={() => {
                    setCreatorOpen(true)
                }}
            >
                <MdPlaylistAdd size={24} />
            </FAB>
            <Drawer
                open={creatorOpen}
                onClose={() => {
                    if (creatorBusy) return false
                    setCreatorOpen(false)
                    return true
                }}
            >
                <ListCreator
                    onBusyChange={setCreatorBusy}
                    onCreated={() => {
                        setUpdater((u) => u + 1)
                    }}
                    onComplete={() => {
                        setCreatorOpen(false)
                    }}
                />
            </Drawer>
            {/* 保存時のpinnedLists reloadで<Lists>のSuspenseが落ちるため、
                行の中に置くとドロワーのportalだけが閉じられず取り残される。境界の外で開く */}
            <Drawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <Suspense fallback={<Text>Loading...</Text>}>
                    {settingsTarget && (
                        <ListSettings
                            key={settingsTarget}
                            uri={settingsTarget}
                            onComplete={() => {
                                setSettingsOpen(false)
                                setUpdater((u) => u + 1)
                            }}
                        />
                    )}
                </Suspense>
            </Drawer>
        </>
    )
}

interface ListsProps {
    listsPromise: Promise<ListType[]>
    onOpenSettings: (uri: string) => void
}

const Lists = (props: ListsProps) => {
    const lists = use(props.listsPromise)

    const { client } = useClient()

    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const [listOrder, setListOrder] = usePreference('listOrder')

    const profile = client.currentProfile
    const order = listOrder?.[profile] ?? []
    // 並び順が未設定のうちは、ホームのタブ順(ピン留め順)を基準にして一覧を並べる
    const effectiveOrder = order.length > 0 ? order : pinnedLists.map((p) => p.uri)

    const sorted = sortByListOrder(lists, effectiveOrder)

    const [ordered, setOrdered] = useState<ListType[]>(sorted)

    // lists や order が外部で更新されたら並びを同期する(レンダー中の状態調整)。
    // 並びが同じでも再取得で新しいListオブジェクトが来たら差し替える(リネーム/アイコン変更の反映)
    const sortedKey = sorted.map((l) => l.uri).join(',')
    const [prevKey, setPrevKey] = useState(sortedKey)
    const [prevLists, setPrevLists] = useState(lists)
    if (sortedKey !== prevKey || lists !== prevLists) {
        setOrdered(sorted)
        setPrevKey(sortedKey)
        setPrevLists(lists)
    }

    const persistOrder = (items: ListType[]) => {
        setListOrder({ ...(listOrder ?? {}), [profile]: items.map((l) => l.uri) })
    }

    return (
        <Reorder.Group
            axis="y"
            values={ordered}
            onReorder={setOrdered}
            style={{ listStyle: 'none', margin: 0, padding: 0, width: '100%' }}
        >
            {ordered.map((list) => (
                <ListRow
                    key={list.uri}
                    list={list}
                    pinned={pinnedLists.some((p) => p.uri === list.uri)}
                    onTogglePin={() => {
                        if (pinnedLists.some((p) => p.uri === list.uri)) {
                            client?.removePin(list.uri)
                        } else {
                            client?.addPin(list.uri)
                        }
                    }}
                    onPersist={() => persistOrder(ordered)}
                    onOpenSettings={props.onOpenSettings}
                />
            ))}
        </Reorder.Group>
    )
}

interface ListRowProps {
    list: ListType
    pinned: boolean
    onTogglePin: () => void
    onPersist: () => void
    onOpenSettings: (uri: string) => void
}

const ListRow = ({ list, pinned, onTogglePin, onPersist, onOpenSettings }: ListRowProps) => {
    const { t } = useTranslation('', { keyPrefix: 'views.lists' })
    const { push } = useStack()
    const controls = useDragControls()
    const [dragging, setDragging] = useState(false)

    return (
        <Reorder.Item
            value={list}
            dragListener={false}
            dragControls={controls}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => {
                setDragging(false)
                onPersist()
            }}
            style={{
                listStyle: 'none',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '2rem',
                width: '100%',
                boxSizing: 'border-box',
                padding: `0 ${CssVar.space(2)}`,
                backgroundColor: dragging ? CssVar.contentBackground : 'transparent'
            }}
        >
            <div
                onClick={() => push(<ListView uri={list.uri} />)}
                style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden'
                }}
            >
                {list.iconURL && (
                    <CCImage
                        src={list.iconURL}
                        maxHeight={128}
                        alt=""
                        style={{
                            height: '1.125rem',
                            marginRight: CssVar.space(1),
                            flexShrink: 0
                        }}
                    />
                )}
                <Text>{list.title}</Text>
            </div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    gap: CssVar.space(1)
                }}
            >
                <IconButton
                    title={t('openSettings')}
                    onClick={(e) => {
                        e.stopPropagation()
                        onOpenSettings(list.uri)
                    }}
                >
                    <MdTune />
                </IconButton>
                <IconButton
                    onClick={(e) => {
                        e.stopPropagation()
                        onTogglePin()
                    }}
                >
                    {pinned ? <RiPushpinFill /> : <RiPushpinLine />}
                </IconButton>
                <div
                    onPointerDown={(e) => controls.start(e)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'grab',
                        touchAction: 'none',
                        color: CssVar.contentText,
                        padding: CssVar.space(1)
                    }}
                >
                    <MdDragHandle size={20} />
                </div>
            </div>
        </Reorder.Item>
    )
}

const ListCreator = ({
    onBusyChange,
    onCreated,
    onComplete
}: {
    onBusyChange: (busy: boolean) => void
    onCreated: () => void
    onComplete: () => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'views.lists' })
    const { client } = useClient()
    const [newListTitle, setNewListTitle] = useState('')
    const [pinOnCreate, setPinOnCreate] = useState(false)
    const [busy, setBusy] = useState(false)
    const [created, setCreated] = useState(false)
    const [error, setError] = useState<'create' | 'pin' | null>(null)

    const createList = async () => {
        if (!client || created || busy) return

        setError(null)
        setBusy(true)
        onBusyChange(true)

        try {
            const key = Date.now().toString()
            const uri = semantics.list(client.ccid, client.currentProfile, key)
            const document: Document<ListSchema> = {
                kind: 'record',
                key: uri,
                schema: Schemas.list,
                value: {
                    name: newListTitle
                },
                author: client.ccid,
                createdAt: new Date()
            }

            try {
                await client.api.commit(document)
            } catch (e) {
                console.error('Failed to create list', e)
                setError('create')
                return
            }

            setCreated(true)
            onCreated()

            if (pinOnCreate) {
                try {
                    await client.addPin(uri)
                } catch (e) {
                    console.error('Failed to pin newly created list', e)
                    setError('pin')
                    return
                }
            }

            onComplete()
        } finally {
            setBusy(false)
            onBusyChange(false)
        }
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
                <Text variant="h3">{t('createList')}</Text>
                <Button disabled={!newListTitle || created || busy} busyChildren={t('creating')} onClick={createList}>
                    {t('create')}
                </Button>
            </div>
            <fieldset
                disabled={busy || created}
                style={{
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4)
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                    <Text variant="h5">{t('listTitle')}</Text>
                    <TextField value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(2) }}>
                    <Checkbox checked={pinOnCreate} onChange={setPinOnCreate} />
                    {t('pinOnCreate')}
                </label>
            </fieldset>
            {error && (
                <div role="alert" aria-live="assertive">
                    <Text style={{ color: '#ff5b5b' }}>{error === 'create' ? t('createFailed') : t('pinFailed')}</Text>
                </div>
            )}
        </div>
    )
}
