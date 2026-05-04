import { Suspense, use, useMemo } from 'react'
import { CssVar, Text, View } from '@concrnt/ui'
import type { Document, Server, SignedDocument } from '@concrnt/client'
import { Link, useLocation } from 'react-router-dom'
import { Schemas, semantics, type CommunityTimelineSchema } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'

export const Explorer = () => {
    const { client } = useClient()
    const location = useLocation()
    const server = location.hash ? location.hash.substring(1) : client!.server.domain

    const serversPromise = useMemo(() => {
        return client!.api.callConcrntApi<Server[]>('', 'net.concrnt.core.known-servers', {})
    }, [client])

    const communitiesPromise = useMemo(() => {
        return client!.api.query(
            {
                prefix: semantics.communities(server),
                schema: Schemas.communityTimeline,
                limit: '100'
            },
            server
        )
    }, [client, server])

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header>Explorer</Header>
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(5),
                    padding: CssVar.space(4)
                }}
            >
                <section
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(3)
                    }}
                >
                    <Text variant="h2">Known Servers</Text>
                    <Suspense fallback={<Text>Loading servers...</Text>}>
                        <ServerList serversPromise={serversPromise} />
                    </Suspense>
                </section>

                <section
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(3)
                    }}
                >
                    <Text variant="h2">Communities on {server}</Text>
                    <Suspense key={server} fallback={<Text>Loading communities...</Text>}>
                        <CommunityList communitiesPromise={communitiesPromise} />
                    </Suspense>
                </section>
            </div>
        </View>
    )
}

const ServerList = ({ serversPromise }: { serversPromise: Promise<Server[]> }) => {
    const servers = use(serversPromise)

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: CssVar.space(2)
            }}
        >
            {servers.map((server) => (
                <Link
                    key={server.domain}
                    to={`#${server.domain}`}
                    style={{
                        display: 'block',
                        padding: CssVar.space(3),
                        borderRadius: CssVar.round(1),
                        border: `1px solid ${CssVar.divider}`,
                        color: CssVar.contentText,
                        textDecoration: 'none'
                    }}
                >
                    {server.domain}
                </Link>
            ))}
        </div>
    )
}

const CommunityList = ({ communitiesPromise }: { communitiesPromise: Promise<SignedDocument[]> }) => {
    const communities = use(communitiesPromise)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2)
            }}
        >
            {communities.map((community) => {
                const document = JSON.parse(community.document) as Document<CommunityTimelineSchema>

                return (
                    <Link
                        key={community.cckv}
                        to={`/timeline/${encodeURIComponent(community.cckv)}`}
                        style={{
                            display: 'block',
                            padding: CssVar.space(3),
                            borderRadius: CssVar.round(1),
                            border: `1px solid ${CssVar.divider}`,
                            color: CssVar.contentText,
                            textDecoration: 'none'
                        }}
                    >
                        <Text
                            variant="h3"
                            style={{
                                marginBottom: CssVar.space(1)
                            }}
                        >
                            {document.value.name}
                        </Text>
                        {document.value.description && (
                            <Text
                                style={{
                                    opacity: 0.78
                                }}
                            >
                                {document.value.description}
                            </Text>
                        )}
                    </Link>
                )
            })}
        </div>
    )
}
