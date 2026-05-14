import { CCWallpaper, CssVar } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { Suspense, use, useMemo } from 'react'
import { Timeline } from '@concrnt/worldlib'
import { Text } from '@concrnt/ui'
import { Subscription } from './Subscription'

interface Props {
    uri: string
}

export const TimelineSettings = (props: Props) => {
    const { client } = useClient()

    const timelinePromise = useMemo(() => client.getTimeline(props.uri), [client, props.uri])

    return (
        <Suspense>
            <Inner timelinePromise={timelinePromise} />
        </Suspense>
    )
}

interface InnerProps {
    timelinePromise: Promise<Timeline | null>
}

const Inner = (props: InnerProps) => {
    const timeline = use(props.timelinePromise)

    if (!timeline) {
        return <>Timeline not found.</>
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                width: '100%'
            }}
        >
            <CCWallpaper src={timeline.banner}>
                <div
                    style={{
                        padding: CssVar.space(2)
                    }}
                >
                    <div
                        style={{
                            backgroundColor: CssVar.contentBackground,
                            padding: CssVar.space(2),
                            borderRadius: CssVar.space(1)
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(2)
                            }}
                        >
                            <Text variant="h2">{timeline.name}</Text>
                        </div>
                        <Text>{timeline.description}</Text>
                    </div>
                </div>
            </CCWallpaper>
            <Subscription target={timeline.uri} />
        </div>
    )
}
