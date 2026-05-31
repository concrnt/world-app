import { Suspense, use, useMemo, useState } from 'react'
import { Reorder, useDragControls, motion } from 'motion/react'
import { Text, IconButton, Button, TextField } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { List as ListType, ListSchema, Schemas, semantics } from '@concrnt/worldlib'
import { Document } from '@concrnt/client'
import { MdPlaylistAdd, MdDragHandle } from 'react-icons/md'

import { RiPushpinFill } from 'react-icons/ri'
import { RiPushpinLine } from 'react-icons/ri'
import { ListSettings } from '../components/ListSettings'
import { useDrawer } from '../contexts/Drawer'
import { CssVar } from '../types/Theme'
import { useSubscribe } from '../hooks/useSubscribe'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'

export const ListsView = () => {
    const { client } = useClient()

    const drawer = useDrawer()

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
                <Header
                    right={
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                            onClick={() => {
                                drawer.open(
                                    <ListCreator
                                        onComplete={() => {
                                            drawer.close()
                                            setUpdater((u) => u + 1)
                                        }}
                                    />
                                )
                            }}
                        >
                            <MdPlaylistAdd size={22} />
                        </div>
                    }
                >
                    Lists
                </Header>
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
                            onUpdate={() => {
                                setUpdater((u) => u + 1)
                            }}
                        />
                    </Suspense>
                </motion.div>
            </View>
        </>
    )
}

interface ListsProps {
    listsPromise: Promise<ListType[]>
    onUpdate?: () => void
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

    // lists や order が外部で更新されたら並びを同期する(レンダー中の状態調整)
    const sortedKey = sorted.map((l) => l.uri).join(',')
    const [prevKey, setPrevKey] = useState(sortedKey)
    if (sortedKey !== prevKey) {
        setOrdered(sorted)
        setPrevKey(sortedKey)
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
                    onUpdate={props.onUpdate}
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
    onUpdate?: () => void
}

const ListRow = ({ list, pinned, onTogglePin, onPersist, onUpdate }: ListRowProps) => {
    const drawer = useDrawer()
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
                onClick={() =>
                    drawer.open(
                        <ListSettings
                            uri={list.uri}
                            onComplete={() => {
                                drawer.close()
                                onUpdate?.()
                            }}
                        />
                    )
                }
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

const ListCreator = ({ onComplete }: { onComplete: () => void }) => {
    const { client } = useClient()
    const [newListTitle, setNewListTitle] = useState('')

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
                <Text variant="h3">リストを作成</Text>
                <Button
                    disabled={!newListTitle}
                    onClick={() => {
                        if (!client) return

                        const key = Date.now().toString()

                        const document: Document<ListSchema> = {
                            key: semantics.list(client.ccid, client.currentProfile, key),
                            schema: Schemas.list,
                            value: {
                                name: newListTitle
                            },
                            author: client.ccid,
                            createdAt: new Date()
                        }

                        client.api.commit(document).then(() => {
                            console.log('Community created')
                            onComplete()
                        })
                    }}
                >
                    作成
                </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">タイトル</Text>
                <TextField value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} />
            </div>
        </div>
    )
}
