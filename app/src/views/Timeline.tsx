import { Text, View } from '@concrnt/ui'
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
import { useDrawer } from '../contexts/Drawer'
import { TimelineSettings } from '../components/TimelineSettings'
import { MdInfo } from 'react-icons/md'

interface Props {
    uri: string
}

export const TimelineView = (props: Props) => {
    const { client, offlineDomain } = useClient()
    const composer = useComposer()
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

    const timelinePromise = useMemo(() => {
        return client!.getTimeline(props.uri).catch(() => null)
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
                <RealtimeTimeline ref={scrollRef} timelines={[props.uri]} hostOverride={hostOverride} />
            </View>
            {!offlineDomain && (
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
            )}
        </>
    )
}
