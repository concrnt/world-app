import { useEffect, useState } from 'react'
import { Button, Text, TextField } from '@concrnt/ui'
import { TimelinePicker } from './TimelinePicker'
import { usePreference } from '../contexts/Preference'
import { useClient } from '../contexts/Client'
import { List, ListSchema, Schemas, Timeline } from '@concrnt/worldlib'
import { parseCCURI } from '@concrnt/client'
import { Document } from '@concrnt/client'

interface Props {
    uri: string
    onComplete?: () => void
}

export const ListSettings = (props: Props) => {
    const { client } = useClient()

    const [pinnedLists, setPinnedLists] = usePreference('pinnedLists')
    const pin = pinnedLists.find((pin) => pin.uri === props.uri)

    const [list, setList] = useState<List | null>(null)
    const [listName, setListName] = useState<string>('')
    const [postTimelines, setPostTimelines] = useState<string[]>(pin?.defaultPostTimelines ?? [])

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

        const newPins = [...pinnedLists]
        const existingIndex = newPins.findIndex((pin) => pin.uri === props.uri)
        if (existingIndex !== -1) {
            newPins[existingIndex] = {
                ...newPins[existingIndex],
                defaultPostTimelines: postTimelines
            }
        } else {
            newPins.push({
                uri: props.uri,
                defaultPostHome: false,
                defaultPostTimelines: postTimelines
            })
        }
        setPinnedLists(newPins)

        const { key } = parseCCURI(props.uri)

        const document: Document<ListSchema> = {
            key: key,
            schema: Schemas.list,
            value: {
                title: listName,
                items: list.items
            },
            author: client.ccid,
            createdAt: new Date()
        }

        client.api.commit(document).then(() => {
            console.log('list updated')
            props.onComplete?.()
        })
    }

    return (
        <div>
            <Text>リスト設定</Text>
            <Text>リスト名</Text>
            <TextField value={listName} onChange={(e) => setListName(e.target.value)} />
            {isPinned && (
                <>
                    <Text>デフォルト投稿先</Text>
                    <TimelinePicker
                        items={list?.communities ?? []}
                        selected={postTimelines}
                        setSelected={setPostTimelines}
                        keyFunc={(item: Timeline) => item.uri}
                        labelFunc={(item: Timeline) => item.name}
                    />
                </>
            )}
            <Button onClick={saveSettings}>設定を保存</Button>

            {isPinned ? (
                <Button
                    onClick={() => {
                        const newPins = pinnedLists.filter((p) => p.uri !== props.uri)
                        setPinnedLists(newPins)
                        props.onComplete?.()
                    }}
                >
                    ピン留め解除
                </Button>
            ) : (
                <Button>リストを削除</Button>
            )}
        </div>
    )
}
