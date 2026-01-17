import { CommunityTimelineSchema, Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text } from '../ui/Text'
import { View } from '../ui/View'
import { Document } from '@concrnt/client'
import { Button } from '../ui/Button'
import { useEffect, useState } from 'react'
import { TextField } from '../ui/TextField'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'
import { TimelineCard } from '../components/TimelineCard'
import { useDrawer } from '../contexts/Drawer'

export const ExplorerView = () => {
    const { client } = useClient()
    const { open } = useSidebar()

    const drawer = useDrawer()

    const [communityName, setCommunityName] = useState('')
    const [communityDescription, setCommunityDescription] = useState('')

    const [communities, setCommunities] = useState<Record<string, Document<CommunityTimelineSchema>>>({})

    useEffect(() => {
        if (!client) return
        client.api
            .query<any>({
                prefix: `cc://${client.server.domain}/concrnt.world/communities/`,
                schema: Schemas.communityTimeline
            })
            .then((results) => {
                setCommunities(results)
                console.log('Fetched communities:', results)
            })
            .catch((error) => {
                console.error('Error fetching communities:', error)
            })
    }, [client])

    const createCommunity = (value: CommunityTimelineSchema) => {
        if (!client) return

        const key = Date.now().toString()

        const document: Document<CommunityTimelineSchema> = {
            key: '/concrnt.world/communities/' + key,
            schema: Schemas.communityTimeline,
            owner: client.server.domain,
            value,
            author: client.ccid,
            createdAt: new Date()
        }

        client.api.commit(document).then(() => {
            console.log('Community created')
        })
    }

    return (
        <>
            <View>
                <Header
                    left={
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                            onClick={() => open()}
                        >
                            <MdMenu size={24} />
                        </div>
                    }
                >
                    Explorer
                </Header>

                <Button
                    onClick={() => {
                        drawer.open(
                            <div>
                                <Text>コミュニティを作成</Text>

                                <Text>名前</Text>
                                <TextField value={communityName} onChange={(e) => setCommunityName(e.target.value)} />
                                <Text>説明</Text>
                                <TextField
                                    value={communityDescription}
                                    onChange={(e) => setCommunityDescription(e.target.value)}
                                />

                                <Button
                                    disabled={!communityName}
                                    onClick={() => {
                                        createCommunity({
                                            name: communityName,
                                            description: communityDescription
                                        })
                                        drawer.close()
                                    }}
                                >
                                    作成
                                </Button>
                            </div>
                        )
                    }}
                >
                    + Create Community
                </Button>
                {Object.entries(communities).map(([uri, community]) => (
                    <TimelineCard key={uri} uri={uri} document={community} />
                ))}
            </View>
        </>
    )
}
