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
import { PrivateContentDoor } from '../components/PrivateContentDoor'

interface Props {
    uri: string
}

export const TimelineView = (props: Props) => {
    const { client } = useClient()
    const drawer = useDrawer()

    const scrollRef = useRef<ScrollViewHandle>(null)

    // uriとセットで保持し、uriが変わった直後に古いtimelineを見せないようにする
    const [fetched, setFetched] = useState<{ uri: string; timeline: Timeline | null }>()
    useEffect(() => {
        if (!client) return
        let cancelled = false
        client
            .getTimeline(props.uri)
            .then((t) => {
                if (!cancelled) setFetched({ uri: props.uri, timeline: t })
            })
            .catch(() => {
                if (!cancelled) setFetched({ uri: props.uri, timeline: null })
            })
        return () => {
            cancelled = true
        }
    }, [client, props.uri])

    // undefined: ロード中 / null: 取得失敗
    const timeline = fetched?.uri === props.uri ? fetched.timeline : undefined

    const restricted = timeline ? timeline.isRestrictedFor(client.ccid) : false

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
                {restricted && timeline ? (
                    <PrivateContentDoor kind="timeline" targetUri={props.uri} owner={timeline.author} />
                ) : (
                    timeline !== undefined && (
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
                    )
                )}
            </View>
        </>
    )
}
