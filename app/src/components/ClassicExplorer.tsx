import { CommunityTimelineSchema, Schemas, semantics } from '@concrnt/worldlib'
import { Suspense, use, useEffect, useMemo, useState } from 'react'
import { useClient } from '../contexts/Client'
import { TimelineCard } from './TimelineCard'
import { Document, Server } from '@concrnt/client'
import { Avatar, Chip, CssVar, Text } from '@concrnt/ui'

export const ClassicExplorer = (props: { updater?: any }) => {
    const { client } = useClient()

    const [serverDomains, setServerDomains] = useState<string[]>(client?.server?.domain ? [client.server.domain] : [])
    const [communities, setCommunities] = useState<Record<string, Document<CommunityTimelineSchema>>>({})

    const [selectedServer, setSelectedServer] = useState<string>(client?.server?.domain ?? '')

    useEffect(() => {
        if (!client) return

        client.api
            .callConcrntApi<Server[]>('', 'net.concrnt.core.known-servers', {})
            .then((response) => {
                setServerDomains(
                    Array.from(new Set([client.server.domain, ...response.map((server) => server.domain)]))
                )
            })
            .catch((error) => {
                console.error('Error fetching servers:', error)
            })
    }, [client])

    useEffect(() => {
        if (!client || !selectedServer) return
        client.api
            .query(
                {
                    prefix: semantics.communities(selectedServer),
                    schema: Schemas.communityTimeline,
                    limit: '100'
                },
                selectedServer
            )
            .then((results) => {
                const mapped: Record<string, Document<CommunityTimelineSchema>> = {}
                results.forEach((sd) => {
                    mapped[sd.cckv] = JSON.parse(sd.document)
                })

                setCommunities(mapped)
            })
            .catch((error) => {
                console.error('Error fetching communities:', error)
                setCommunities({})
            })
    }, [client, selectedServer, props.updater])

    return (
        <>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(1)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: CssVar.space(1)
                    }}
                >
                    <Text variant="h3" style={{ margin: 0 }}>
                        Known Servers
                    </Text>
                    <Text variant="caption" style={{ margin: 0 }}>
                        {serverDomains.length} servers
                    </Text>
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: CssVar.space(1)
                    }}
                >
                    {serverDomains.map((domain) => (
                        <ServerChip
                            key={domain}
                            domain={domain}
                            selected={selectedServer === domain}
                            onSelect={() => setSelectedServer(domain)}
                        />
                    ))}
                </div>
            </div>
            <Text variant="h3">Communities:</Text>
            <Text variant="caption">{`Selected: ${selectedServer}`}</Text>
            {Object.entries(communities).map(([uri, community]) => (
                <TimelineCard key={uri} uri={uri} document={community} />
            ))}
        </>
    )
}

const ServerChip = (props: { domain: string; selected: boolean; onSelect: () => void }) => {
    const { client } = useClient()

    const serverPromise = useMemo(() => {
        return client.api
            .getServer(props.domain, { cache: 'no-cache' })
            .then((server) => ({ server, offline: false }))
            .catch(() => ({ server: null, offline: true }))
    }, [client, props.domain])

    return (
        <Suspense
            fallback={
                <ServerChipBody
                    domain={props.domain}
                    selected={props.selected}
                    onSelect={props.onSelect}
                    server={null}
                    offline={false}
                />
            }
        >
            <ServerChipBody
                domain={props.domain}
                selected={props.selected}
                onSelect={props.onSelect}
                serverPromise={serverPromise}
            />
        </Suspense>
    )
}

const ServerChipBody = (props: {
    domain: string
    selected: boolean
    onSelect: () => void
    server?: Server | null
    offline?: boolean
    serverPromise?: Promise<{ server: Server | null; offline: boolean }>
}) => {
    const result = props.serverPromise
        ? use(props.serverPromise)
        : { server: props.server ?? null, offline: props.offline ?? false }
    const server = result.server
    const offline = result.offline
    const nickname =
        typeof server?.meta?.nickname === 'string' && server.meta.nickname ? server.meta.nickname : undefined
    const logo = typeof server?.meta?.logo === 'string' && server.meta.logo ? server.meta.logo : undefined
    const label = nickname || server?.domain || props.domain

    return (
        <Chip
            variant={props.selected ? 'contained' : 'outlined'}
            disabled={offline}
            onClick={props.onSelect}
            headElement={
                offline ? (
                    <div
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(220, 38, 38, 0.18)',
                            border: '1px solid rgba(220, 38, 38, 0.55)'
                        }}
                    />
                ) : server ? (
                    <Avatar
                        ccid={props.domain}
                        src={logo}
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%'
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(0, 0, 0, 0.12)'
                        }}
                    />
                )
            }
            tailElement={
                offline ? (
                    <span
                        style={{
                            fontSize: 12,
                            opacity: 0.8,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        オフライン
                    </span>
                ) : nickname ? (
                    <span
                        style={{
                            fontSize: 12,
                            opacity: 0.65,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {server?.domain}
                    </span>
                ) : undefined
            }
            style={{
                height: 32,
                padding: '0 8px',
                borderColor: props.selected ? 'rgba(0, 0, 0, 0.24)' : CssVar.divider,
                backgroundColor: props.selected ? 'rgba(0, 0, 0, 0.12)' : undefined,
                maxWidth: '100%'
            }}
        >
            <span
                style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}
            >
                {offline ? props.domain : label}
            </span>
        </Chip>
    )
}
