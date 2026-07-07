import { CommunityTimelineSchema, Schemas, semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text, Button, TextField } from '@concrnt/ui'
import { Document } from '@concrnt/client'
import { useState, useRef, useTransition } from 'react'
import { useDrawer } from '../contexts/Drawer'
import { MdAdd } from 'react-icons/md'
import { hapticSuccess } from '../utils/haptics'
import { SearchExplorer } from '../components/SearchExplorer'
import { CssVar } from '../types/Theme'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { usePersistent } from '../hooks/usePersistent'
import { invalidateResource } from '../hooks/useResource'
import { ClassicExplorer } from '../components/ClassicExplorer'
import { useNavigate } from 'react-router-dom'

export const ExplorerView = () => {
    const drawer = useDrawer()
    const navigate = useNavigate()
    const scrollRef = useRef<HTMLDivElement>(null)
    const { client } = useClient()

    const [preferredClassicMode, setPreferredClassicMode] = usePersistent('explorer-classic-mode', false)
    const [, startModeTransition] = useTransition()
    const supportsSearchExplorer = client.server.layer === 'concrnt-mainnet'
    const classicMode = supportsSearchExplorer ? preferredClassicMode : true

    return (
        <>
            <View>
                <Header
                    onTitleTap={
                        supportsSearchExplorer
                            ? () => {
                                  startModeTransition(() => {
                                      setPreferredClassicMode((v) => !v)
                                  })
                              }
                            : undefined
                    }
                    right={
                        <Button
                            variant="text"
                            onClick={() => {
                                drawer.open(
                                    <CommunityCreator
                                        onComplete={(uri) => {
                                            invalidateResource(`communities:${client.server.domain}`)
                                            drawer.close()
                                            navigate('/timeline/' + encodeURIComponent(uri))
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

const CommunityCreator = ({ onComplete }: { onComplete: (uri: string) => void }) => {
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
            },
            onUpdate: 'forget'
        }
        await client.api.commit(document)
        console.log('Community created')
        return document.key
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
                        const uri = await createCommunity({
                            name: communityName,
                            description: communityDescription
                        })
                        if (!uri) return
                        hapticSuccess()
                        onComplete(uri)
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
