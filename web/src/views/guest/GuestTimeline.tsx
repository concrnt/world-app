import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '@concrnt/ui'
import { CssVar } from '../../types/Theme'
import { useClient } from '../../contexts/Client'
import { RealtimeTimeline } from '../../components/RealtimeTimeline'
import { TimelineTag } from '../../components/TimelineTag'
import { ScrollViewHandle } from '../../types/ScrollView'
import { View } from '../../components/View'
import { Header } from '../../components/Header'
import { Timeline } from '@concrnt/worldlib'
import { MdLock } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'

interface Props {
    uri: string
}

// views/Timeline.tsx のゲスト(未ログイン)版。Composerと設定を持たず、リアルタイム更新も行わない
export const GuestTimelineView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'web.guestTimeline' })
    const { client } = useClient()
    const navigate = useNavigate()

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
                <Header onTitleTap={() => scrollRef.current?.scrollToTop()}>
                    <TimelineTag uri={props.uri} />
                </Header>
                {restricted && timeline ? (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: CssVar.space(2),
                            padding: CssVar.space(4)
                        }}
                    >
                        <MdLock size={48} style={{ opacity: 0.5 }} />
                        <Text>{t('privateTimeline')}</Text>
                        <Text variant="caption">{t('loginRequired')}</Text>
                        <Button onClick={() => navigate('/login')}>{t('login')}</Button>
                    </div>
                ) : (
                    timeline !== undefined && <RealtimeTimeline ref={scrollRef} timelines={[props.uri]} noRealtime />
                )}
            </View>
        </>
    )
}
