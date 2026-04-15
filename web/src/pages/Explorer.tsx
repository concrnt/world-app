import { Suspense, use, useMemo } from "react"
import { useClient } from "../contexts/Client"
import type { Server, Document, SignedDocument } from "@concrnt/client"
import { Schemas, type CommunityTimelineSchema } from "@concrnt/worldlib"
import { Link, useLocation } from "react-router-dom"

export const Explorer = () => {

    const { client } = useClient()
    const location = useLocation()
    const server = location.hash ? location.hash.substring(1) : client.server.domain

    const serversPromise = useMemo(() => {
        return client.api.callConcrntApi<Server[]>('', 'net.concrnt.core.known-servers', {})
    }, [])

    const communitiesPromise = useMemo(() => {
        return client.api.query(
            {
                prefix: `cckv://${server}/concrnt.world/communities/`,
                schema: Schemas.communityTimeline,
                limit: '100'
            },
            server
        )
    }, [server])

    return (
        <div>
            <h2>Known Servers</h2>
            <Suspense fallback={<div>Loading servers...</div>}>
                <ServerList serversPromise={serversPromise} />
            </Suspense>

            <h2>Communities on {server}</h2>
            <Suspense 
                key={server}
                fallback={<div>Loading communities...</div>}
            >
                <CommunityList communitiesPromise={communitiesPromise} />
            </Suspense>
        </div>
    )
}


const ServerList = ({ serversPromise }: { serversPromise: Promise<Server[]> }) => {
    const servers = use(serversPromise)
    return <ul>
        {servers.map(server => (
            <li key={server.domain}>
                <Link to={`#${server.domain}`}>
                    {server.domain}
                </Link>
            </li>
        ))}
    </ul>
}

const CommunityList = ({ communitiesPromise }: { communitiesPromise: Promise<SignedDocument[]> }) => {
    const communities = use(communitiesPromise)
    return <ul>
        {communities.map(community => {
            const document = JSON.parse(community.document) as Document<CommunityTimelineSchema>
            return <li key={community.cckv}>
                <Link to={`/timeline/${encodeURIComponent(community.cckv)}`}>
                    {document.value.name}
                </Link>
            </li>
        })}
    </ul>
}

