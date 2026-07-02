import { Divider, Text } from '@concrnt/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
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
    const { client, offlineDomain } = useClient()
    const drawer = useDrawer()

    const scrollRef = useRef<ScrollViewHandle>(null)
    const timelineHost = useMemo(() => {
        try {
            const host = new URL(props.uri).host
            return host.includes('.') ? host : undefined
        } catch {
            return undefined
        }
    }, [props.uri])
    const hostOverride = offlineDomain && timelineHost !== offlineDomain ? timelineHost : undefined

    const [timeline, setTimeline] = useState<Timeline>(null)
    useEffect(() => {
        if (!client) return
        client
            .getTimeline(props.uri)
            .then(setTimeline)
            .catch(() => setTimeline(null))
    }, [client, props.uri])

    if (offlineDomain && !hostOverride) {
        return (
            <View>
                <Header>Timeline</Header>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Text variant="h3">タイムラインを読み込めません</Text>
                    <Text style={{ opacity: 0.7 }}>
                        自分のドメインがオフラインのため、このタイムラインを取得できません。
                    </Text>
                </div>
            </View>
        )
    }

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
                    hostOverride={hostOverride}
                    headElement={
                        offlineDomain ? undefined : (
                            <>
                                <Composer
                                    inline
                                    mode="normal"
                                    destinations={[props.uri]}
                                    options={timeline ? [timeline] : []}
                                />
                                <Divider />
                            </>
                        )
                    }
                />
            </View>
        </>
    )
}
