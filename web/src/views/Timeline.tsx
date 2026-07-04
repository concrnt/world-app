import { Divider } from '@concrnt/ui'
import { useEffect, useRef, useState } from 'react'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { TimelineTag } from '../components/TimelineTag'
import { ScrollViewHandle } from '../types/ScrollView'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { Composer } from '../components/Composer'
import { Timeline } from '@concrnt/worldlib'
import { MdInfo } from 'react-icons/md'
import { useDrawer } from '../contexts/Drawer'
import { TimelineSettings } from '../components/TimelineSettings'

interface Props {
    uri: string
}

export const TimelineView = (props: Props) => {
    const { client } = useClient()
    const drawer = useDrawer()

    const scrollRef = useRef<ScrollViewHandle>(null)

    const [timeline, setTimeline] = useState<Timeline>(null)
    useEffect(() => {
        if (!client) return
        client
            .getTimeline(props.uri)
            .then(setTimeline)
            .catch(() => setTimeline(null))
    }, [client, props.uri])

    return (
        <>
            <View>
                <Header
                    onTitleTap={() => scrollRef.current?.scrollToTop()}
                    right={
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                            onClick={() => drawer.open(<TimelineSettings uri={props.uri} />)}
                        >
                            <MdInfo size={24} />
                        </div>
                    }
                >
                    <TimelineTag uri={props.uri} />
                </Header>
                <RealtimeTimeline
                    ref={scrollRef}
                    timelines={[props.uri]}
                    headElement={
                        <>
                            <div style={{ padding: CssVar.space(2) }}>
                                <Composer
                                    mode="normal"
                                    destinations={[props.uri]}
                                    options={timeline ? [timeline] : []}
                                />
                            </div>
                            <Divider />
                        </>
                    }
                />
            </View>
        </>
    )
}
