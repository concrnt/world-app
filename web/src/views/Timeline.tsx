import { Button, View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useMemo } from 'react'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { useComposer } from '../contexts/Composer'
import { MdCreate } from 'react-icons/md'
import { TimelineTag } from '../components/TimelineTag'

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
                <Header
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
                <RealtimeTimeline timelines={[props.uri]} />
            </View>
        </>
    )
}
