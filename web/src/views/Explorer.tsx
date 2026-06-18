import { CommunityTimelineSchema, Schemas, semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text, Button, TextField } from '@concrnt/ui'
import { Document } from '@concrnt/client'
import { useState, useRef } from 'react'
import { useDrawer } from '../contexts/Drawer'
import { MdAdd } from 'react-icons/md'
import { hapticSuccess } from '../utils/haptics'
import { SearchExplorer } from '../components/SearchExplorer'
import { CssVar } from '../types/Theme'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { usePersistent } from '../hooks/usePersistent'
import { ClassicExplorer } from '../components/ClassicExplorer'

export const ExplorerView = () => {
    const drawer = useDrawer()
    const scrollRef = useRef<HTMLDivElement>(null)

    const [classicMode, setClassicMode] = usePersistent('explorer-classic-mode', false)

    return (
        <>
            <View>
                <Header
                    onTitleTap={() => {
                        setClassicMode((v) => !v)
                    }}
                    right={
                        <Button
                            variant="text"
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
                            <MdAdd size={22} />
                        </Button>
                    }
                >
                    {classicMode ? 'Explorer (Classic)' : 'Explorer'}
                </Header>
                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2),
                        padding: CssVar.space(2),
                        overflowY: 'auto'
                    }}
                >
                    {classicMode ? <ClassicExplorer /> : <SearchExplorer />}
                </div>
            </View>
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
            kind: 'record',
            key: semantics.community(client.server.domain, key),
            schema: Schemas.communityTimeline,
            value,
            author: client.ccid,
            createdAt: new Date(),
            policy: {
                entries: [
                    {
                        url: 'https://policy.concrnt.world/t/write-public.json'
                    }
                ]
            }
        }
        await client.api.commit(document)
        console.log('Community created')
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                width: '100%'
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
