import { Button } from '@concrnt/ui'
import { useMemo, useRef } from 'react'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { useComposer } from '../contexts/Composer'
import { MdCreate } from 'react-icons/md'
import { TimelineTag } from '../components/TimelineTag'
import { ScrollViewHandle } from '../types/ScrollView'
import { View } from '../components/View'
import { Header } from '../components/Header'

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
                <Header
                    onTitleTap={() => scrollRef.current?.scrollToTop()}
                    right={
                        <Button
                            variant="text"
                            onClick={() => {
                                timelinePromise.then((t) => {
                                    const options = t ? [t] : []
                                    composer.open([props.uri], options)
                                })
                            }}
                        >
                            <MdCreate size={22} />
                        </Button>
                    }
                >
                    <TimelineTag uri={props.uri} />
                </Header>
                <RealtimeTimeline ref={scrollRef} timelines={[props.uri]} />
            </View>
        </>
    )
}
