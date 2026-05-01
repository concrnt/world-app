import { Suspense, use, useMemo, useState } from 'react'
import { Header } from '../ui/Header'
import { View, Text, IconButton, Button, TextField, List, ListItem } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { List as ListType, ListSchema, Schemas, semantics } from '@concrnt/worldlib'
import { Document } from '@concrnt/client'
import { MdPlaylistAdd } from 'react-icons/md'

import { RiPushpinFill } from 'react-icons/ri'
import { RiPushpinLine } from 'react-icons/ri'
import { ListSettings } from '../components/ListSettings'
import { useDrawer } from '../contexts/Drawer'
import { FAB } from '../ui/FAB'
import { CssVar } from '../types/Theme'
import { useSubscribe } from '../hooks/useSubscribe'

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
                <Header>Lists</Header>
                <div
                    style={{
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
                </div>
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
    listsPromise: Promise<ListType[]>
    onUpdate?: () => void
}

const Lists = (props: ListsProps) => {
    const lists = use(props.listsPromise)
    const drawer = useDrawer()

    const { client } = useClient()

    const [pinnedLists] = useSubscribe(client.pinnedLists)

    return (
        <List>
            {lists.map((list) => (
                <ListItem
                    key={list.uri}
                    style={{
                        height: '2rem'
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
                    secondaryAction={
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation()
                                if (pinnedLists.find((p) => p.uri === list.uri)) {
                                    // unpin
                                    client?.removePin(list.uri)
                                } else {
                                    // pin
                                    client?.addPin(list.uri)
                                }
                            }}
                        >
                            {pinnedLists.find((p) => p.uri === list.uri) ? <RiPushpinFill /> : <RiPushpinLine />}
                        </IconButton>
                    }
                >
                    <Text>{list.title}</Text>
                </ListItem>
            ))}
        </List>
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
                width: '100%'
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
