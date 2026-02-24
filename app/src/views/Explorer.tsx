import { CommunityTimelineSchema, Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text, View, Button, TextField } from '@concrnt/ui'
import { Document } from '@concrnt/client'
import { useState } from 'react'
import { Header } from '../ui/Header'
import { useDrawer } from '../contexts/Drawer'
import { FAB } from '../ui/FAB'
import { MdAdd } from 'react-icons/md'
import { ClassicExplorer } from '../components/ClassicExplorer'

export const ExplorerView = () => {
    const drawer = useDrawer()

    return (
        <>
            <View>
                <Header>Explorer</Header>
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        padding: '4px'
                    }}
                >
                    <ClassicExplorer />
                </div>
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
