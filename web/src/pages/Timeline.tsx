import { Divider, Text } from "@concrnt/ui"
import { Composer } from "../components/Composer"
import { RealtimeTimeline } from "../components/RealtimeTimeline"
import { useParams } from "react-router-dom"
import { useMemo } from "react"
import { useClient } from "../contexts/Client"
import type { CommunityTimelineSchema } from "@concrnt/worldlib"

export const Timeline = () => {

    const { client } = useClient()

    const { uri } = useParams()
    const timelineUri = uri ? decodeURIComponent(uri) : null
    const timelines = timelineUri ? [timelineUri] : []

    const timelinePromise = useMemo(() => {
        if (!client || !timelineUri) return null
        return client.api.getDocument<CommunityTimelineSchema>(timelineUri)
    }, [timelineUri])

    return <div>
        <Text
            variant="h1"
        >
            {timelinePromise.then(doc => doc.value.name)}
        </Text>
        <Composer
            additionalDestinations={timelines}
        />
        <Divider />
        <RealtimeTimeline
            timelines={timelines}
        />
    </div>
}

