import { Suspense, useEffect, useState } from 'react'
import { Button, CssVar, Text } from '@concrnt/ui'
import type { Timeline } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useSubscribe } from '../hooks/useSubscribe'
import { TimelinePicker } from './TimelinePicker'

interface Props {
    uri: string
    onComplete?: () => void
}

export const ListSettings = (props: Props) => {
    const { client } = useClient()
    const [pinnedLists] = useSubscribe(client!.pinnedLists)
    const pin = pinnedLists.find((item) => item.uri === props.uri)
    const [postTimelines, setPostTimelines] = useState<string[]>(pin?.defaultPostTimelines ?? [])

    useEffect(() => {
        setPostTimelines(pin?.defaultPostTimelines ?? [])
    }, [pin])

    if (!client || !pin) {
        return (
            <div style={{ padding: CssVar.space(4) }}>
                <Text>リスト設定を表示できませんでした。</Text>
            </div>
        )
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                padding: CssVar.space(4)
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h3">デフォルト投稿先</Text>
                <Text>このホームタブから新規投稿するときの投稿先を選びます。</Text>
            </div>

            <Suspense fallback={<Text>Loading...</Text>}>
                <DefaultPostTimelines selected={postTimelines} setSelected={setPostTimelines} />
            </Suspense>

            <div
                style={{
                    display: 'flex',
                    gap: CssVar.space(2),
                    justifyContent: 'flex-end'
                }}
            >
                <Button
                    variant="outlined"
                    onClick={() => {
                        void client.removePin(props.uri).then(() => props.onComplete?.())
                    }}
                >
                    ピン留め解除
                </Button>
                <Button
                    onClick={() => {
                        void client.updatePinnedList(props.uri, {
                            defaultPostTimelines: postTimelines
                        }).then(() => props.onComplete?.())
                    }}
                >
                    保存
                </Button>
            </div>
        </div>
    )
}

const DefaultPostTimelines = (props: { selected: string[]; setSelected: (timelines: string[]) => void }) => {
    const { client } = useClient()
    const [knownCommunities] = useSubscribe(client!.knownCommunities)

    return (
        <TimelinePicker
            items={knownCommunities}
            selected={props.selected}
            setSelected={props.setSelected}
            keyFunc={(item: Timeline) => item.uri}
            labelFunc={(item: Timeline) => item.name}
        />
    )
}
