import { Divider } from "@concrnt/ui"
import { Composer } from "../components/Composer"
import { RealtimeTimeline } from "../components/RealtimeTimeline"
import { useClient } from "../contexts/Client"


export const Home = () => {

    const { client } = useClient()
    const timelines = client ? [`cckv://${client.ccid}/concrnt.world/main/home-timeline`] : []

    return <div>
        <h1>Home</h1>
        <Composer />
        <Divider />
        <RealtimeTimeline
            timelines={timelines}
        />
    </div>
}

