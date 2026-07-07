import { CommunityTimelineSchema, Schemas, semantics } from '@concrnt/worldlib'
import { Suspense, useDeferredValue, useState } from 'react'
import { useClient } from '../contexts/Client'
import { TimelineCard } from './TimelineCard'
import { Document, Server } from '@concrnt/client'
import { Avatar, Chip, CssVar, Text } from '@concrnt/ui'
import { useResource } from '../hooks/useResource'

export const ClassicExplorer = () => {
    const { client } = useClient()

    const [selectedServer, setSelectedServer] = useState<string>(client?.server?.domain ?? '')

    // チップのハイライトは即時反応させ、コミュニティ一覧だけ遅れて追従させる
    const deferredServer = useDeferredValue(selectedServer)
    const isStale = deferredServer !== selectedServer

    return (
        <>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(1)
                }}
            >
                <Suspense
                    fallback={
                        <Text variant="caption" style={{ opacity: 0.5 }}>
                            読み込み中...
                        </Text>
                    }
                >
                    <ServerList selectedServer={selectedServer} onSelect={setSelectedServer} />
                </Suspense>
            </div>
            <Text variant="h3">Communities:</Text>
            <Text variant="caption">{`Selected: ${selectedServer}`}</Text>
            <Suspense
                fallback={
                    <Text variant="caption" style={{ opacity: 0.5 }}>
                        読み込み中...
                    </Text>
                }
            >
                <CommunityList server={deferredServer} dimmed={isStale} />
            </Suspense>
        </>
    )
}

const ServerList = (props: { selectedServer: string; onSelect: (domain: string) => void }) => {
    const { client } = useClient()

    const serverDomains = useResource(`known-servers:${client.server.domain}`, () =>
        client.api
            .callConcrntApi<Server[]>('', 'net.concrnt.core.known-servers', {})
            .then((response) => Array.from(new Set([client.server.domain, ...response.map((server) => server.domain)])))
            .catch((error) => {
                console.error('Error fetching servers:', error)
                return [client.server.domain]
            })
    )

    return (
        <>
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
                        selected={props.selectedServer === domain}
                        onSelect={() => props.onSelect(domain)}
                    />
                ))}
            </div>
        </>
    )
}

const CommunityList = (props: { server: string; dimmed: boolean }) => {
    const { client } = useClient()

    const communities = useResource<Record<string, Document<CommunityTimelineSchema>>>(
        `communities:${props.server}`,
        () => {
            if (!props.server) return Promise.resolve({})
            return client.api
                .query(
                    {
                        prefix: semantics.communities(props.server),
                        schema: Schemas.communityTimeline,
                        limit: '100'
                    },
                    props.server
                )
                .then((results) => {
                    const mapped: Record<string, Document<CommunityTimelineSchema>> = {}
                    results.forEach((sd) => {
                        mapped[sd.cckv] = JSON.parse(sd.document)
                    })
                    return mapped
                })
                .catch((error): Record<string, Document<CommunityTimelineSchema>> => {
                    console.error('Error fetching communities:', error)
                    return {}
                })
        }
    )

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                opacity: props.dimmed ? 0.6 : 1,
                transition: 'opacity 0.2s'
            }}
        >
            {Object.entries(communities).map(([uri, community]) => (
                <TimelineCard key={uri} uri={uri} document={community} />
            ))}
        </div>
    )
}

const ServerChip = (props: { domain: string; selected: boolean; onSelect: () => void }) => {
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
            <ServerChipContent {...props} />
        </Suspense>
    )
}

const ServerChipContent = (props: { domain: string; selected: boolean; onSelect: () => void }) => {
    const { client } = useClient()

    const { server, offline } = useResource(`server:${props.domain}`, () =>
        client.api
            .getServer(props.domain)
            .then((server) => ({ server: (server ?? null) as Server | null, offline: false }))
            .catch(() => ({ server: null, offline: true }))
    )

    return (
        <ServerChipBody
            domain={props.domain}
            selected={props.selected}
            onSelect={props.onSelect}
            server={server}
            offline={offline}
        />
    )
}

const ServerChipBody = (props: {
    domain: string
    selected: boolean
    onSelect: () => void
    server: Server | null
    offline: boolean
}) => {
    const server = props.server
    const offline = props.offline
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
