import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useMemo, useRef } from 'react'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { FAB } from '../ui/FAB'
import { useComposer } from '../contexts/Composer'
import { MdCreate } from 'react-icons/md'
import { hapticLight } from '../utils/haptics'
import { TimelineTag } from '../components/TimelineTag'
import { ScrollViewHandle } from '../types/ScrollView'

interface Props {
    uri: string
}

export const TimelineView = (props: Props) => {
    const { client } = useClient()
    const composer = useComposer()

    const scrollRef = useRef<ScrollViewHandle>(null)

    const timelinePromise = useMemo(() => {
        return client!.getTimeline(props.uri).catch(() => null)
    }, [client, props.uri])

    return (
        <>
            <View>
                <Header onTitleTap={() => scrollRef.current?.scrollToTop()}>
                    <TimelineTag uri={props.uri} />
                </Header>
                <RealtimeTimeline ref={scrollRef} timelines={[props.uri]} />
            </View>
            <FAB
                onClick={() => {
                    hapticLight()
                    timelinePromise.then((t) => {
                        const options = t ? [t] : []
                        composer.open([props.uri], options)
                    })
                }}
            >
                <MdCreate size={24} />
            </FAB>
        </>
    )
}
