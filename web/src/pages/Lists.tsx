import { useEffect, useState } from 'react'
import { Button, CssVar, Tab, Tabs, Text, TextField, View } from '@concrnt/ui'
import type { Document } from '@concrnt/client'
import { List as ListModel, Schemas, semantics, type ListSchema, type Timeline } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useSubscribe } from '../hooks/useSubscribe'
import { Header } from '../ui/Header'
import { Modal } from '../components/Modal'
import { TimelinePicker } from '../components/TimelinePicker'
import { ListSettings } from '../components/ListSettings'

export const Lists = () => {
    const { client } = useClient()
    const [editingList, setEditingList] = useState<ListModel | null>(null)
    const [newListOpen, setNewListOpen] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    if (!client) return null

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header
                right={
                    <Button
                        onClick={() => {
                            setNewListOpen(true)
                        }}
                    >
                        New List
                    </Button>
                }
            >
                Lists
            </Header>

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <ListsBody
                    key={`${client.ccid}:${client.currentProfile}:${reloadKey}`}
                    onEdit={(list) => setEditingList(list)}
                    onReload={() => setReloadKey((value) => value + 1)}
                />
            </div>

            {editingList && (
                <ListEditorModal
                    list={editingList}
                    onClose={() => setEditingList(null)}
                    onComplete={() => {
                        setEditingList(null)
                        setReloadKey((value) => value + 1)
                    }}
                />
            )}

            {newListOpen && (
                <ListCreatorModal
                    onClose={() => setNewListOpen(false)}
                    onComplete={() => {
                        setNewListOpen(false)
                        setReloadKey((value) => value + 1)
                    }}
                />
            )}
        </View>
    )
}

const ListsBody = (props: { onEdit: (list: ListModel) => void; onReload: () => void }) => {
    const { client } = useClient()
    const [lists, setLists] = useState<ListModel[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!client) return
        let isCancelled = false

        void client
            .getLists()
            .then((nextLists) => {
                if (isCancelled) return
                setLists(nextLists)
            })
            .finally(() => {
                if (isCancelled) return
                setLoading(false)
            })

        return () => {
            isCancelled = true
        }
    }, [client])

    if (loading) {
        return <Text>Loading lists...</Text>
    }

    if (lists.length === 0) {
        return <Text>まだリストがありません。</Text>
    }

    return (
        <>
            {lists.map((list) => (
                <ListCard key={list.uri} list={list} onEdit={() => props.onEdit(list)} onReload={props.onReload} />
            ))}
        </>
    )
}

const ListCard = (props: { list: ListModel; onEdit: () => void; onReload: () => void }) => {
    const { client } = useClient()
    const [pinnedLists] = useSubscribe(client!.pinnedLists)
    const [items] = useSubscribe(props.list.items)
    const isPinned = pinnedLists.some((pin) => pin.uri === props.list.uri)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                padding: CssVar.space(3),
                borderRadius: CssVar.round(1),
                border: `1px solid ${CssVar.divider}`
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: CssVar.space(2)
                }}
            >
                <div>
                    <Text variant="h3">{props.list.title}</Text>
                    <Text variant="caption">{items.length} items</Text>
                </div>
                <div
                    style={{
                        display: 'flex',
                        gap: CssVar.space(2)
                    }}
                >
                    <Button
                        variant={isPinned ? 'contained' : 'outlined'}
                        onClick={() => {
                            if (!client) return
                            void (isPinned ? client.removePin(props.list.uri) : client.addPin(props.list.uri)).then(props.onReload)
                        }}
                    >
                        {isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button variant="outlined" onClick={props.onEdit}>
                        Manage
                    </Button>
                </div>
            </div>

            {items.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: CssVar.space(1)
                    }}
                >
                    {items.map((item) => (
                        <div
                            key={item}
                            style={{
                                padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                                borderRadius: CssVar.round(1),
                                border: `1px solid ${CssVar.divider}`
                            }}
                        >
                            <Text variant="caption">{item}</Text>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const ListCreatorModal = (props: { onClose: () => void; onComplete: () => void }) => {
    const { client } = useClient()
    const [title, setTitle] = useState('')

    if (!client) return null

    return (
        <Modal title="リストを作成" onClose={props.onClose} width="520px">
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <TextField value={title} onChange={(event) => setTitle(event.target.value)} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        disabled={!title.trim()}
                        onClick={() => {
                            const key = Date.now().toString()
                            const document: Document<ListSchema> = {
                                key: semantics.list(client.ccid, client.currentProfile, key),
                                schema: Schemas.list,
                                value: {
                                    name: title.trim()
                                },
                                author: client.ccid,
                                createdAt: new Date()
                            }

                            void client.api.commit(document).then(props.onComplete)
                        }}
                    >
                        作成
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

const ListEditorModal = (props: { list: ListModel; onClose: () => void; onComplete: () => void }) => {
    const { client } = useClient()
    const [pinnedLists] = useSubscribe(client!.pinnedLists)
    const [knownCommunities] = useSubscribe(client!.knownCommunities)
    const [currentItems] = useSubscribe(props.list.items)
    const [tab, setTab] = useState<'items' | 'pinned'>('items')

    if (!client) return null

    const isPinned = pinnedLists.some((pin) => pin.uri === props.list.uri)
    const isHomeList = props.list.uri === semantics.homeList(client.ccid, client.currentProfile)

    const deleteList = async () => {
        const refs = await client.api.query({
            prefix: props.list.uri,
            limit: 100
        })

        for (const ref of refs) {
            await client.api.delete(ref.cckv ?? ref.ccfs)
        }

        if (isPinned) {
            await client.removePin(props.list.uri)
        }

        await client.api.delete(props.list.uri)
    }

    return (
        <Modal title={props.list.title} onClose={props.onClose} width="720px">
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0
                }}
            >
                <Tabs
                    style={{
                        paddingInline: CssVar.space(2),
                        borderBottom: `1px solid ${CssVar.divider}`
                    }}
                >
                    <Tab selected={tab === 'items'} onClick={() => setTab('items')} groupId="list-editor-tabs" style={{ color: CssVar.contentText }}>
                        Items
                    </Tab>
                    <Tab selected={tab === 'pinned'} onClick={() => setTab('pinned')} groupId="list-editor-tabs" style={{ color: CssVar.contentText }}>
                        Pinned
                    </Tab>
                </Tabs>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(4),
                        padding: CssVar.space(4),
                        overflowY: 'auto'
                    }}
                >
                    {tab === 'items' && (
                        <ListItemsEditor
                            key={`${props.list.uri}:${currentItems.join('|')}`}
                            currentItems={currentItems}
                            knownCommunities={knownCommunities}
                            isHomeList={isHomeList}
                            onDelete={() => {
                                void deleteList().then(props.onComplete)
                            }}
                            onSave={(selectedItems) => {
                                void saveItemsForSelection(selectedItems).then(props.onComplete)
                            }}
                        />
                    )}

                    {tab === 'pinned' && (
                        <>
                            {!isPinned ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: CssVar.space(2) }}>
                                    <Text>このリストはまだピン留めされていません。</Text>
                                    <Button
                                        onClick={() => {
                                            void client.addPin(props.list.uri).then(props.onComplete)
                                        }}
                                    >
                                        ピン留めする
                                    </Button>
                                </div>
                            ) : (
                                <ListSettings uri={props.list.uri} onComplete={props.onComplete} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </Modal>
    )

    async function saveItemsForSelection(selectedItems: string[]) {
        const currentSet = new Set(currentItems)
        const nextSet = new Set(selectedItems)

        for (const uri of selectedItems) {
            if (!currentSet.has(uri)) {
                await props.list.addItem(client, uri, Schemas.communityTimeline)
            }
        }

        for (const uri of currentItems) {
            if (!nextSet.has(uri)) {
                await props.list.removeItem(client, uri)
            }
        }
    }
}

const ListItemsEditor = (props: {
    currentItems: string[]
    knownCommunities: Timeline[]
    isHomeList: boolean
    onDelete: () => void
    onSave: (selectedItems: string[]) => void
}) => {
    const [selectedItems, setSelectedItems] = useState<string[]>(props.currentItems)

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h3">リスト内容</Text>
                <TimelinePicker
                    items={props.knownCommunities}
                    selected={selectedItems}
                    setSelected={setSelectedItems}
                    keyFunc={(item: Timeline) => item.uri}
                    labelFunc={(item: Timeline) => item.name}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: CssVar.space(2) }}>
                <Button variant="outlined" disabled={props.isHomeList} onClick={props.onDelete}>
                    リストを削除
                </Button>
                <Button onClick={() => props.onSave(selectedItems)}>保存</Button>
            </div>
        </>
    )
}
