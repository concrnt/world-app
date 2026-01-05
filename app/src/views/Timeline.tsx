import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'
import { use, useMemo } from 'react'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

interface Props {
    uri: string
}

export const TimelineView = (props: Props) => {
    const { open } = useSidebar()
    const { client } = useClient()

    const timelinePromise = useMemo(() => {
        return client!.getTimeline(props.uri).catch(() => null)
    }, [client, props.uri])
    const timeline = use(timelinePromise)

    return (
        <View>
            <Header
                left={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        onClick={() => open()}
                    >
                        <MdMenu size={24} />
                    </div>
                }
            >
                {timeline ? timeline.name : 'Timeline'}
            </Header>
            <RealtimeTimeline timelines={[props.uri]} />
        </View>
    )
}
