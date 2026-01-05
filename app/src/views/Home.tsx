import { useMemo } from 'react'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'
import { useSidebar } from '../layouts/Sidebar'
import { View } from '../ui/View'
import { MdMenu } from 'react-icons/md'
import { ScrollViewProps } from '../types/ScrollView'
import { RealtimeTimeline } from '../components/RealtimeTimeline'

export const HomeView = (props: ScrollViewProps) => {
    const { client } = useClient()
    const timelines = useMemo(
        () => [`cc://${client?.ccid}/concrnt.world/main/home-timeline`, ...(client?.home?.items ?? [])],
        [client]
    )

    const { open } = useSidebar()

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
                Home
            </Header>
            <RealtimeTimeline ref={props.ref} timelines={timelines} />
        </View>
    )
}
