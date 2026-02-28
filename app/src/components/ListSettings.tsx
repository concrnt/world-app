import { useEffect, useState } from 'react'
import { Button, Text, TextField } from '@concrnt/ui'
import { TimelinePicker } from './TimelinePicker'
import { usePreference } from '../contexts/Preference'
import { useClient } from '../contexts/Client'
import { List, ListSchema, Schemas, Timeline } from '@concrnt/worldlib'
import { Document } from '@concrnt/client'
import { CssVar } from '../types/Theme'

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

        const document: Document<ListSchema> = {
            key: props.uri,
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
                <Text variant="h3">リスト設定</Text>
                <Button onClick={saveSettings}>保存</Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">リスト名</Text>
                <TextField value={listName} onChange={(e) => setListName(e.target.value)} />
            </div>
            {isPinned && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                    <Text variant="h5">デフォルト投稿先</Text>
                    <TimelinePicker
                        items={list?.communities ?? []}
                        selected={postTimelines}
                        setSelected={setPostTimelines}
                        keyFunc={(item: Timeline) => item.uri}
                        labelFunc={(item: Timeline) => item.name}
                    />
                </div>
            )}

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
