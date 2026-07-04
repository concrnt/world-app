import { Suspense, useEffect, useState } from 'react'
import { Button, Switch, Text, TextField } from '@concrnt/ui'
import { TimelinePicker } from './TimelinePicker'
import { useClient } from '../contexts/Client'
import { List, Timeline } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { useSubscribe } from '../hooks/useSubscribe'

interface Props {
    uri: string
    onComplete?: () => void
}

export const ListSettings = (props: Props) => {
    const { client } = useClient()

    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const pin = pinnedLists.find((pin) => pin.uri === props.uri)

    const [list, setList] = useState<List | null>(null)
    const [listName, setListName] = useState<string>('')
    const [postTimelines, setPostTimelines] = useState<string[]>(pin?.defaultPostTimelines ?? [])
    const [postProfile, setPostProfile] = useState<string>(pin?.defaultProfile ?? client?.currentProfile ?? 'main')
    const [excludeSelf, setExcludeSelf] = useState<boolean>(pin?.excludeSelf ?? false)

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

        await client.updatePinnedList(props.uri, {
            defaultPostTimelines: postTimelines,
            defaultProfile: postProfile,
            excludeSelf
        })

        props.onComplete?.()
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
                <Text variant="h3">リスト設定</Text>
                <Button onClick={saveSettings} busyChildren="保存中...">
                    保存
                </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">リスト名</Text>
                <TextField value={listName} onChange={(e) => setListName(e.target.value)} />
            </div>
            {isPinned && (
                <Suspense fallback={<Text>Loading...</Text>}>
                    <DefaultPostTimelines
                        selected={postTimelines}
                        setSelected={setPostTimelines}
                        selectedProfile={postProfile}
                        setSelectedProfile={setPostProfile}
                    />
                </Suspense>
            )}
            {isPinned && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <Text variant="h5">自分の投稿を含めない</Text>
                    <Switch checked={excludeSelf} onChange={setExcludeSelf} />
                </div>
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
                <Button
                    onClick={() => {
                        client?.api.delete(props.uri).then(() => {
                            props.onComplete?.()
                        })
                    }}
                >
                    リストを削除
                </Button>
            )}
        </div>
    )
}

const DefaultPostTimelines = (props: {
    selected: string[]
    setSelected: (timelines: string[]) => void
    selectedProfile: string
    setSelectedProfile: (profile: string) => void
}) => {
    const { client } = useClient()
    const [knownCommunities] = useSubscribe(client.knownCommunities)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <Text variant="h5">デフォルト投稿先</Text>
            <TimelinePicker
                items={knownCommunities}
                selected={props.selected}
                setSelected={props.setSelected}
                keyFunc={(item: Timeline) => item.uri}
                labelFunc={(item: Timeline) => item.name}
                selectedProfile={props.selectedProfile}
                setSelectedProfile={props.setSelectedProfile}
            />
        </div>
    )
}
