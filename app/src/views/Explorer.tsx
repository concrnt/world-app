import { CommunityTimelineSchema, Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text } from '../ui/Text'
import { View } from '../ui/View'
import { Document } from '@concrnt/client'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { useEffect, useState } from 'react'
import { TextField } from '../ui/TextField'
import { MdPlaylistAdd } from 'react-icons/md'
import { IconButton } from '../ui/IconButton'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'

export const ExplorerView = () => {
    const { client } = useClient()
    const { open } = useSidebar()

    const [openEditor, setOpenEditor] = useState(false)
    const [communityName, setCommunityName] = useState('')
    const [communityDescription, setCommunityDescription] = useState('')

    const [communities, setCommunities] = useState<Record<string, any>>([])

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
                        setOpenEditor(true)
                    }}
                >
                    + Create Community
                </Button>
                {Object.entries(communities).map(([key, community]) => (
                    <div key={key} style={{ border: '1px solid #ccc', padding: '8px', margin: '8px 0' }}>
                        <Text>{community.value.name}</Text>
                        <Text>{community.value.description}</Text>
                        <IconButton
                            onClick={() => {
                                if (!client) return
                                client.home
                                    ?.addItem(client, key)
                                    .then(() => {
                                        console.log('Community added to home')
                                    })
                                    .catch((error) => {
                                        console.error('Error adding community to home:', error)
                                    })
                            }}
                        >
                            <MdPlaylistAdd />
                        </IconButton>
                    </div>
                ))}
            </View>
            <Drawer
                open={openEditor}
                onClose={() => {
                    setOpenEditor(false)
                }}
                style={{
                    padding: '8px'
                }}
            >
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
                        setOpenEditor(false)
                    }}
                >
                    作成
                </Button>
            </Drawer>
        </>
    )
}
