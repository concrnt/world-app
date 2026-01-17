import { useEffect, useState } from 'react'
import { Header } from '../ui/Header'
import { View } from '../ui/View'
import { MdMenu } from 'react-icons/md'
import { useClient } from '../contexts/Client'
import { ListSchema, Schemas } from '@concrnt/worldlib'
import { Button } from '../ui/Button'
import { Text } from '../ui/Text'
import { Document } from '@concrnt/client'

import { RiPushpinFill } from 'react-icons/ri'
import { RiUnpinFill } from 'react-icons/ri'
import { IconButton } from '../ui/IconButton'
import { Reorder } from 'motion/react'
import { usePreference } from '../contexts/Preference'
import { ListSettings } from '../components/ListSettings'
import { useDrawer } from '../contexts/Drawer'

export const ListsView = () => {
    const { client } = useClient()
    const [pinnedLists, setPinnedLists] = usePreference('pinnedLists')
    const [lists, setLists] = useState<Record<string, Document<ListSchema>>>({})

    const drawer = useDrawer()

    const createList = (value: ListSchema) => {
        if (!client) return

        const key = Date.now().toString()

        const document: Document<ListSchema> = {
            key: '/concrnt.world/lists/' + key,
            schema: Schemas.list,
            value,
            author: client.ccid,
            createdAt: new Date()
        }

        client.api.commit(document).then(() => {
            console.log('Community created')
        })
    }

    useEffect(() => {
        if (!client) return
        client.api
            .query<any>({
                prefix: `cc://${client.ccid}/concrnt.world/`,
                schema: Schemas.list
            })
            .then((results) => {
                setLists(results)
                console.log('Fetched communities:', results)
            })
            .catch((error) => {
                console.error('Error fetching communities:', error)
            })
    }, [client])

    return (
        <View>
            <Header
                left={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        onClick={() => open()}
                    >
                        <MdMenu size={24} />
                    </div>
                }
            >
                Lists
            </Header>
            <div>
                <Button
                    onClick={() => {
                        createList({ title: '新しいリスト', items: [], meta: {} })
                    }}
                >
                    新規作成
                </Button>
                <Text variant="h3">ピン留め</Text>
                <Reorder.Group values={pinnedLists} onReorder={setPinnedLists}>
                    {pinnedLists.map((pinned) => (
                        <Reorder.Item
                            key={pinned.uri}
                            value={pinned}
                            style={{}}
                            onClick={() =>
                                drawer.open(<ListSettings uri={pinned.uri} onComplete={() => drawer.close()} />)
                            }
                        >
                            <div
                                style={{
                                    border: '1px solid #ccc',
                                    padding: 10,
                                    marginBottom: 10,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <Text>{lists[pinned.uri]?.value.title ?? '無題のリスト'}</Text>
                            </div>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>

                <Text variant="h3">すべてのリスト</Text>
                {Object.entries(lists).map(([uri, list]) => (
                    <div
                        key={uri}
                        style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10 }}
                        onClick={() => drawer.open(<ListSettings uri={uri} onComplete={() => drawer.close()} />)}
                    >
                        <Text variant="h4">{list.value.title}</Text>
                        <Text>アイテム数: {list.value.items.length}</Text>
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation()
                                const isPinned = pinnedLists.some((p) => p.uri === uri)
                                if (isPinned) {
                                    const newPins = pinnedLists.filter((p) => p.uri !== uri)
                                    setPinnedLists(newPins)
                                } else {
                                    setPinnedLists([
                                        ...pinnedLists,
                                        { uri: uri, defaultPostHome: false, defaultPostTimelines: [] }
                                    ])
                                }
                            }}
                        >
                            {pinnedLists.some((p) => p.uri === uri) ? <RiUnpinFill /> : <RiPushpinFill />}
                        </IconButton>
                    </div>
                ))}
            </div>
        </View>
    )
}
