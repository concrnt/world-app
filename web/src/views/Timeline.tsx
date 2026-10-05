import { Divider } from '@concrnt/ui'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { TimelineTag } from '../components/TimelineTag'
import { ScrollViewHandle } from '../types/ScrollView'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { Composer } from '../components/Composer'
import { Timeline, isStaticTimelineURI } from '@concrnt/worldlib'
import { MdInfo } from 'react-icons/md'
import { Drawer } from '../components/Drawer'
import { TimelineSettings } from '../components/TimelineSettings'
import { PrivateContentDoor } from '../components/PrivateContentDoor'
import { ComposeFAB } from '../components/ComposeFAB'
import { PostContextProvider } from '../contexts/PostContext'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
    uri: string
}

export const TimelineView = (props: Props) => {
    const { client } = useClient()
    const [settingsOpen, setSettingsOpen] = useState(false)
    const isMobile = useIsMobile()
    const navigate = useNavigate()

    const scrollRef = useRef<ScrollViewHandle>(null)

    // 静的タイムライン(https manifest)はドキュメントを持たないので解決せず読み出し専用で表示する
    const isStatic = isStaticTimelineURI(props.uri)

    // uriとセットで保持し、uriが変わった直後に古いtimelineを見せないようにする
    const [fetched, setFetched] = useState<{ uri: string; timeline: Timeline | null }>()
    useEffect(() => {
        if (!client || isStatic) return
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
    }, [client, props.uri, isStatic])

    // undefined: ロード中 / null: 取得失敗(静的タイムラインは解決しないので常にnull)
    const timeline = isStatic ? null : fetched?.uri === props.uri ? fetched.timeline : undefined

    const restricted = timeline ? timeline.isRestrictedFor(client.ccid) : false

    // インラインエディタの投稿先。このタイムラインを初期値にしつつ、その場で編集できるようにする
    const [destinations, setDestinations] = useState<string[]>([props.uri])
    // 別のタイムラインに移ったら投稿先も差し替える
    const [prevUri, setPrevUri] = useState(props.uri)
    if (prevUri !== props.uri) {
        setPrevUri(props.uri)
        setDestinations([props.uri])
    }

    return (
        <PostContextProvider destinations={isStatic ? [] : [props.uri]}>
            <View>
                <Header
                    onTitleTap={() => scrollRef.current?.scrollToTop()}
                    right={
                        isStatic ? undefined : (
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                                onClick={() => setSettingsOpen(true)}
                            >
                                <MdInfo size={24} />
                            </div>
                        )
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
                            noRealtime={isStatic}
                            headElement={
                                // モバイルではインラインエディタは出さず、FABからモーダルで投稿する(app版と同じ体験)
                                // 静的タイムラインは読み出し専用なので出さない
                                isMobile || isStatic ? undefined : (
                                    <>
                                        <div style={{ padding: CssVar.space(2) }}>
                                            <Composer
                                                mode="normal"
                                                destinations={destinations}
                                                setDestinations={setDestinations}
                                                defaultDestinations={[props.uri]}
                                            />
                                        </div>
                                        <Divider />
                                    </>
                                )
                            }
                        />
                    )
                )}
            </View>
            {!restricted && !isStatic && <ComposeFAB />}
            {/* 静的タイムラインには設定ドキュメントがない(マウントするとuriの解決が走る) */}
            {!isStatic && (
                <Drawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                    <TimelineSettings
                        uri={props.uri}
                        onDeleted={() => {
                            setSettingsOpen(false)
                            navigate('/')
                        }}
                    />
                </Drawer>
            )}
        </PostContextProvider>
    )
}
