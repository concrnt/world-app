import { CommunityTimelineSchema, Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text, View, Button, TextField } from '@concrnt/ui'
import { Document } from '@concrnt/client'
import { useState } from 'react'
import { Header } from '../ui/Header'
import { useDrawer } from '../contexts/Drawer'
import { FAB } from '../ui/FAB'
import { MdAdd } from 'react-icons/md'
import { hapticLight, hapticSuccess } from '../utils/haptics'
import { ClassicExplorer } from '../components/ClassicExplorer'
import { CssVar } from '../types/Theme'

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
                        gap: CssVar.space(2),
                        padding: CssVar.space(2)
                    }}
                >
                    <ClassicExplorer />
                </div>
            </View>
            <FAB
                onClick={() => {
                    hapticLight()
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

    const createCommunity = async (value: CommunityTimelineSchema) => {
        if (!client) return

        const key = Date.now().toString()

        const document: Document<CommunityTimelineSchema> = {
            key: `cckv://${client.server.domain}/concrnt.world/communities/${key}`,
            schema: Schemas.communityTimeline,
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

        await client.api.commit(document)
        console.log('Community created')
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4)
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Text variant="h3">コミュニティを作成</Text>
                <Button
                    disabled={!communityName}
                    onClick={async () => {
                        await createCommunity({
                            name: communityName,
                            description: communityDescription
                        })
                        hapticSuccess()
                        onComplete()
                    }}
                >
                    作成
                </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">名前</Text>
                <TextField value={communityName} onChange={(e) => setCommunityName(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">説明</Text>
                <TextField value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} />
            </div>
        </div>
    )
}
