import { useEffect, useState } from 'react'
import { Button, CssVar, Text, TextField } from '@concrnt/ui'
import type { Document } from '@concrnt/client'
import { List as ListModel, Schemas, semantics, type ListSchema } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Modal } from './Modal'

interface Props {
    targetUri: string
    targetName?: string
    onClose: () => void
    onComplete?: () => void
}

export const AddToListModal = (props: Props) => {
    const { client } = useClient()
    const [lists, setLists] = useState<ListModel[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [newListTitle, setNewListTitle] = useState('')

    useEffect(() => {
        if (!client) return
        let isCancelled = false
        setLoading(true)
        void client.getLists().then((nextLists) => {
            if (isCancelled) return
            setLists(nextLists)
            setLoading(false)
        })
        return () => {
            isCancelled = true
        }
    }, [client, creating])

    if (!client) return null

    const addToList = async (list: ListModel) => {
        const currentItems = await list.items.value()
        if (!currentItems.includes(props.targetUri)) {
            await list.addItem(client, props.targetUri, Schemas.communityTimeline)
        }
        props.onComplete?.()
        props.onClose()
    }

    const createListAndAdd = async () => {
        if (!newListTitle.trim()) return
        setCreating(true)
        try {
            const key = Date.now().toString()
            const document: Document<ListSchema> = {
                key: semantics.list(client.ccid, client.currentProfile, key),
                schema: Schemas.list,
                value: {
                    name: newListTitle.trim()
                },
                author: client.ccid,
                createdAt: new Date()
            }

            await client.api.commit(document)
            const createdList = await client.getList(document.key)
            if (createdList) {
                await addToList(createdList)
            }
        } finally {
            setCreating(false)
        }
    }

    return (
        <Modal title="リストに追加" onClose={props.onClose} width="560px">
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4),
                    padding: CssVar.space(4),
                    overflowY: 'auto'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
                    <Text variant="h3">{props.targetName ?? '対象コミュニティ'}</Text>
                    <Text variant="caption">{props.targetUri}</Text>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                    <Text variant="h3">既存のリスト</Text>
                    {loading && <Text>Loading lists...</Text>}
                    {!loading && lists.length === 0 && <Text>まだリストがありません。</Text>}
                    {!loading &&
                        lists.map((list) => (
                            <button
                                key={list.uri}
                                type="button"
                                onClick={() => {
                                    void addToList(list)
                                }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: CssVar.space(2),
                                    padding: CssVar.space(3),
                                    borderRadius: CssVar.round(1),
                                    border: `1px solid ${CssVar.divider}`,
                                    backgroundColor: 'transparent',
                                    color: CssVar.contentText,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <span>{list.title}</span>
                                <span>追加</span>
                            </button>
                        ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                    <Text variant="h3">新しいリストを作成</Text>
                    <TextField value={newListTitle} onChange={(event) => setNewListTitle(event.target.value)} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button disabled={creating || !newListTitle.trim()} onClick={() => void createListAndAdd()}>
                            {creating ? '作成中...' : '作成して追加'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
