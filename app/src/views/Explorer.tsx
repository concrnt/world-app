import { CommunityTimelineSchema, Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text } from '../ui/Text'
import { View } from '../ui/View'
import { Document } from '@concrnt/client'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { useState } from 'react'
import { TextField } from '../ui/TextField'

export const ExplorerView = () => {
    const { client } = useClient()

    const [openEditor, setOpenEditor] = useState(false)
    const [communityName, setCommunityName] = useState('')
    const [communityDescription, setCommunityDescription] = useState('')

    const createCommunity = (value: CommunityTimelineSchema) => {
        if (!client) return

        const key = Date.now().toString()

        const document: Document<CommunityTimelineSchema> = {
            key: '/concrnt.world/communities/' + key,
            schema: Schemas.communityTimeline,
            owner: client.server.csid,
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
                <Text>Explorer View</Text>

                <Button
                    onClick={() => {
                        setOpenEditor(true)
                    }}
                >
                    + Create Community
                </Button>
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
