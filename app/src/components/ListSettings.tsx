import { Suspense, useEffect, useState } from 'react'
import { Button, Text, TextField } from '@concrnt/ui'
import { TimelinePicker } from './TimelinePicker'
import { useClient } from '../contexts/Client'
import { List, Timeline } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'

interface Props {
    uri: string
    onComplete?: () => void
}

export const ListSettings = (props: Props) => {
    const { client } = useClient()

    const pinnedLists = client?.pinnedLists ?? []
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

        client.updatePinnedList(props.uri, {
            defaultPostTimelines: postTimelines
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
                <Suspense fallback={<Text>Loading...</Text>}>
                    <DefaultPostTimelines selected={postTimelines} setSelected={setPostTimelines} />
                </Suspense>
            )}

            {isPinned ? (
                <Button
                    onClick={() => {
                        client?.removePin(props.uri).then(() => {
                            props.onComplete?.()
                        })
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

const DefaultPostTimelines = (props: { selected: string[]; setSelected: (timelines: string[]) => void }) => {
    const { client } = useClient()

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <Text variant="h5">デフォルト投稿先</Text>
            <TimelinePicker
                items={client?.knownCommunities ?? []}
                selected={props.selected}
                setSelected={props.setSelected}
                keyFunc={(item: Timeline) => item.uri}
                labelFunc={(item: Timeline) => item.name}
            />
        </div>
    )
}
