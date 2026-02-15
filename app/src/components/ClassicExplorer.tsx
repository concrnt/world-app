import { CommunityTimelineSchema, Schemas } from '@concrnt/worldlib'
import { useEffect, useState } from 'react'
import { useClient } from '../contexts/Client'
import { TimelineCard } from './TimelineCard'
import { Document, Server } from '@concrnt/client'
import { Text } from '../ui/Text'

export const ClassicExplorer = () => {
    const { client } = useClient()

    const [servers, setServers] = useState<Server[]>([])
    const [communities, setCommunities] = useState<Record<string, Document<CommunityTimelineSchema>>>({})

    const [selectedServer, setSelectedServer] = useState<string>(client?.server?.domain ?? '')

    useEffect(() => {
        if (!client) return

        client.api
            .callConcrntApi<Server[]>('', 'net.concrnt.core.known-servers', {})
            .then((response) => {
                setServers([client.server, ...response])
            })
            .catch((error) => {
                console.error('Error fetching servers:', error)
            })
    }, [client])

    useEffect(() => {
        if (!client) return
        client.api
            .query(
                {
                    prefix: `cckv://${selectedServer}/concrnt.world/communities/`,
                    schema: Schemas.communityTimeline
                },
                selectedServer
            )
            .then((results) => {
                const mapped: Record<string, Document<CommunityTimelineSchema>> = {}
                results.forEach((sd) => {
                    mapped[sd.cckv] = JSON.parse(sd.document)
                })

                setCommunities(mapped)
                console.log('Fetched communities:', results)
            })
            .catch((error) => {
                console.error('Error fetching communities:', error)
            })
    }, [client, selectedServer])

    return (
        <>
            <Text variant="h3">Known Servers:</Text>
            {Object.entries(servers).map(([uri, server]) => (
                <div key={uri} onClick={() => setSelectedServer(server.domain)}>
                    <Text>{server.domain}</Text>
                </div>
            ))}
            <Text variant="h3">Communities:</Text>
            <Text variant="caption">{`Selected: ${selectedServer}`}</Text>
            {Object.entries(communities).map(([uri, community]) => (
                <TimelineCard key={uri} uri={uri} document={community} />
            ))}
        </>
    )
}
