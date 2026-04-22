import { Divider } from "@concrnt/ui"
import { Composer } from "../components/Composer"
import { RealtimeTimeline } from "../components/RealtimeTimeline"
import { useClient } from "../contexts/Client"
import { semantics } from "@concrnt/worldlib"


export const Home = () => {

    const { client } = useClient()
    const timelines = client ? [semantics.homeTimeline(client.ccid, client.currentProfile)] : []

    return <div>
        <h1>Home</h1>
        <Composer />
        <Divider />
        <RealtimeTimeline
            timelines={timelines}
        />
    </div>
}

