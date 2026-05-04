import { useEffect, useMemo, useState } from 'react'
import { CssVar, Text, View } from '@concrnt/ui'
import { useParams } from 'react-router-dom'
import type { CommunityTimelineSchema } from '@concrnt/worldlib'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { useComposerLauncher } from '../contexts/Composer'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'

export const Timeline = () => {
    const { client } = useClient()
    const composer = useComposerLauncher()
    const { uri } = useParams()
    const [title, setTitle] = useState('Timeline')

    const timelineUri = uri ? decodeURIComponent(uri) : null
    const timelines = useMemo(() => (timelineUri ? [timelineUri] : []), [timelineUri])

    const timelinePromise = useMemo(() => {
        if (!client || !timelineUri) return null
        return client.api.getDocument<CommunityTimelineSchema>(timelineUri).catch(() => null)
    }, [client, timelineUri])

    useEffect(() => {
        if (!timelinePromise) return

        let isCancelled = false
        timelinePromise.then((document) => {
            if (isCancelled) return
            setTitle(document?.value.name ?? 'Timeline')
        })

        return () => {
            isCancelled = true
        }
    }, [timelinePromise])

    useEffect(() => {
        composer.setAdditionalDestinations(timelines)

        return () => {
            composer.setAdditionalDestinations([])
        }
    }, [composer, timelineUri, timelines])

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header>{title}</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    flex: 1
                }}
            >
                {timelineUri ? (
                    <RealtimeTimeline timelines={timelines} />
                ) : (
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: CssVar.space(5)
                        }}
                    >
                        <Text>タイムラインを指定してください。</Text>
                    </div>
                )}
            </div>
        </View>
    )
}
