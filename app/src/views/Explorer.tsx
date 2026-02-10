import { CommunityTimelineSchema, Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text } from '../ui/Text'
import { View } from '../ui/View'
import { Document } from '@concrnt/client'
import { Button } from '../ui/Button'
import { useEffect, useState } from 'react'
import { TextField } from '../ui/TextField'
import { Header } from '../ui/Header'
import { TimelineCard } from '../components/TimelineCard'
import { useDrawer } from '../contexts/Drawer'
import { FAB } from '../ui/FAB'
import { MdAdd } from 'react-icons/md'

export const ExplorerView = () => {
    const { client } = useClient()

    const drawer = useDrawer()

    const [communities, setCommunities] = useState<Record<string, Document<CommunityTimelineSchema>>>({})

    useEffect(() => {
        if (!client) return
        client.api
            .query({
                prefix: `cckv://${client.server.domain}/concrnt.world/communities/`,
                schema: Schemas.communityTimeline
            })
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
    }, [client])

    return (
        <>
            <View>
                <Header>Explorer</Header>

                {Object.entries(communities).map(([uri, community]) => (
                    <TimelineCard key={uri} uri={uri} document={community} />
                ))}
            </View>
            <FAB
                onClick={() => {
                    drawer.open(
                        <CommunityCreator
                            onComplete={() => {
                                drawer.close()
                            }}
                        />
                    )
                }}
            >
                <MdAdd size={24} />
            </FAB>
        </>
    )
}

const CommunityCreator = ({ onComplete }: { onComplete: () => void }) => {
    const [communityName, setCommunityName] = useState('')

    const [communityDescription, setCommunityDescription] = useState('')

    const { client } = useClient()

    const createCommunity = (value: CommunityTimelineSchema) => {
        if (!client) return

        const key = Date.now().toString()

        const document: Document<CommunityTimelineSchema> = {
            key: '/concrnt.world/communities/' + key,
            schema: Schemas.communityTimeline,
            owner: client.server.domain,
            value,
            author: client.ccid,
            createdAt: new Date(),
            policies: [
                {
                    url: 'https://policy.concrnt.world/t/inline-allow-deny.json',
                    params: {
                        readListMode: false,
                        reader: [],
                        writeListMode: false,
                        writer: []
                    }
                }
            ]
        }

        client.api.commit(document).then(() => {
            console.log('Community created')
        })
    }

    return (
        <div>
            <Text>コミュニティを作成</Text>

            <Text>名前</Text>
            <TextField value={communityName} onChange={(e) => setCommunityName(e.target.value)} />
            <Text>説明</Text>
            <TextField value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} />

            <Button
                disabled={!communityName}
                onClick={() => {
                    createCommunity({
                        name: communityName,
                        description: communityDescription
                    })
                    onComplete()
                }}
            >
                作成
            </Button>
        </div>
    )
}
