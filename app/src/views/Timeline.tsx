import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { Text } from '../ui/Text'
import { useMemo } from 'react'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { FAB } from '../ui/FAB'
import { useComposer } from '../contexts/Composer'
import { MdCreate } from 'react-icons/md'

interface Props {
    uri: string
}

export const TimelineView = (props: Props) => {
    const { client } = useClient()
    const composer = useComposer()

    const timelinePromise = useMemo(() => {
        return client!.getTimeline(props.uri).catch(() => null)
    }, [client, props.uri])

    return (
        <>
            <View>
                <Header>
                    <Text>{timelinePromise.then((t) => (t ? t.name : 'Timeline'))}</Text>
                </Header>
                <RealtimeTimeline timelines={[props.uri]} />
            </View>
            <FAB
                onClick={() => {
                    composer.open([props.uri])
                }}
            >
                <MdCreate size={24} />
            </FAB>
        </>
    )
}
