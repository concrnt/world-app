import { Suspense, use, useMemo, useState } from 'react'
import { Header } from '../ui/Header'
import { View, Text, IconButton, Button, TextField } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { List, ListSchema, Schemas, semantics } from '@concrnt/worldlib'
import { Document } from '@concrnt/client'
import { MdPlaylistAdd } from 'react-icons/md'

import { RiPushpinFill } from 'react-icons/ri'
import { RiPushpinLine } from 'react-icons/ri'
import { usePreference } from '../contexts/Preference'
import { ListSettings } from '../components/ListSettings'
import { useDrawer } from '../contexts/Drawer'
import { FAB } from '../ui/FAB'
import { CssVar } from '../types/Theme'

export const ListsView = () => {
    const { client } = useClient()

    const drawer = useDrawer()

    const [updater, setUpdater] = useState(0)
    const listsPromise = useMemo(() => {
        if (!client) return Promise.resolve([])
        return client.getLists()
    }, [client, updater])

    return (
        <>
            <View>
                <Header>Lists</Header>
                <Suspense fallback={<Text>Loading...</Text>}>
                    <Lists
                        listsPromise={listsPromise}
                        onUpdate={() => {
                            setUpdater((u) => u + 1)
                        }}
                    />
                </Suspense>
            </View>
            <FAB
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
                <MdPlaylistAdd size={24} />
            </FAB>
        </>
    )
}

interface ListsProps {
    listsPromise: Promise<List[]>
    onUpdate?: () => void
}

const Lists = (props: ListsProps) => {
    const lists = use(props.listsPromise)
    const drawer = useDrawer()

    const [pinnedLists, setPinnedLists] = usePreference('pinnedLists')

    return (
        <div style={{ padding: '8px' }}>
            {lists.map((list) => (
                <div
                    key={list.uri}
                    style={{
                        border: '1px solid #ccc',
                        padding: 10,
                        marginBottom: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                    onClick={() =>
                        drawer.open(
                            <ListSettings
                                uri={list.uri}
                                onComplete={() => {
                                    drawer.close()
                                    props.onUpdate?.()
                                }}
                            />
                        )
                    }
                >
                    <Text>{list.title}</Text>
                    <Text>アイテム数: {list.items.length}</Text>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            if (pinnedLists.find((p) => p.uri === list.uri)) {
                                // unpin
                                setPinnedLists(pinnedLists.filter((p) => p.uri !== list.uri))
                            } else {
                                // pin
                                setPinnedLists([
                                    ...pinnedLists,
                                    { uri: list.uri, defaultPostHome: false, defaultPostTimelines: [] }
                                ])
                            }
                        }}
                    >
                        {pinnedLists.find((p) => p.uri === list.uri) ? <RiPushpinFill /> : <RiPushpinLine />}
                    </IconButton>
                </div>
            ))}
        </div>
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
                gap: CssVar.space(4)
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
                            key: semantics.list(client.ccid, 'main', key),
                            schema: Schemas.list,
                            value: {
                                title: newListTitle,
                                items: []
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
