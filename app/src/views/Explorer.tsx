import { CommunityTimelineSchema, Schemas, semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text, View, Button, TextField } from '@concrnt/ui'
import { Document } from '@concrnt/client'
import { Suspense, useState, useRef, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '../ui/Header'
import { Drawer } from '../ui/Drawer'
import { FAB } from '../ui/FAB'
import { MdAdd } from 'react-icons/md'
import { useHaptics } from '../contexts/Haptics'
import { SearchExplorer } from '../components/SearchExplorer'
import { CssVar } from '../types/Theme'
import { ClassicExplorer } from '../components/ClassicExplorer'
import { usePersistent } from '../hooks/usePersistent'
import { invalidateResource } from '../hooks/useResource'
import { useStack } from '../layouts/Stack'
import { TimelineView } from './Timeline'
import { useSubscribe } from '../hooks/useSubscribe'
import type { PinnedListItemClass } from '@concrnt/worldlib'

export const ExplorerView = () => {
    const [creatorOpen, setCreatorOpen] = useState(false)
    const { push } = useStack()
    const { hapticLight } = useHaptics()
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
                        paddingBottom: '7rem',
                        overflowY: 'auto',
                        touchAction: 'pan-y'
                    }}
                >
                    {classicMode ? <ClassicExplorer /> : <SearchExplorer />}
                </div>
            </View>
            <FAB
                onClick={() => {
                    hapticLight()
                    setCreatorOpen(true)
                }}
            >
                <MdAdd size={24} />
            </FAB>
            <Drawer open={creatorOpen} onClose={() => setCreatorOpen(false)}>
                <CommunityCreator
                    onComplete={(uri) => {
                        invalidateResource(`communities:${client.server.domain}`)
                        setCreatorOpen(false)
                        push(<TimelineView uri={uri} />)
                    }}
                />
            </Drawer>
        </>
    )
}

const CommunityCreator = ({ onComplete }: { onComplete: (uri: string) => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.explorer' })
    const { hapticSuccess } = useHaptics()
    const [communityName, setCommunityName] = useState('')
    const [communityDescription, setCommunityDescription] = useState('')
    const [selectedListUri, setSelectedListUri] = useState<string>()
    const [createdCommunityUri, setCreatedCommunityUri] = useState<string>()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string>()
    const communityUriRef = useRef<string | undefined>(undefined)
    const { client } = useClient()

    const createCommunity = async (value: CommunityTimelineSchema) => {
        if (!client) return
        const uri = communityUriRef.current ?? semantics.community(client.server.domain, Date.now().toString())
        communityUriRef.current = uri
        const document: Document<CommunityTimelineSchema> = {
            kind: 'record',
            key: uri,
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
                <Text variant="h3">{t('createCommunity')}</Text>
                <Button
                    disabled={!communityName || isSubmitting}
                    onClick={async () => {
                        setIsSubmitting(true)
                        setError(undefined)
                        try {
                            const uri =
                                createdCommunityUri ??
                                (await createCommunity({
                                    name: communityName,
                                    description: communityDescription
                                }))
                            if (!uri) return
                            setCreatedCommunityUri(uri)

                            const pinnedLists = await client.pinnedLists.value()
                            const selectedPin = selectedListUri
                                ? pinnedLists.find((pin) => pin.uri === selectedListUri)
                                : (pinnedLists.find((pin) => pin.defaultPostHome) ?? pinnedLists[0])
                            let list = await selectedPin?.list.value()
                            if (!list && selectedPin) {
                                await selectedPin.list.refresh()
                                list = await selectedPin.list.value()
                            }
                            if (!list) throw new Error(t('listUnavailable'))
                            await list.addItem(client, uri, Schemas.communityTimeline)

                            hapticSuccess()
                            onComplete(uri)
                        } catch (e) {
                            console.error('Failed to create community and add it to a list', e)
                            setError(e instanceof Error ? e.message : String(e))
                        } finally {
                            setIsSubmitting(false)
                        }
                    }}
                >
                    {createdCommunityUri ? t('retryAddToList') : t('create')}
                </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">{t('name')}</Text>
                <TextField
                    disabled={createdCommunityUri !== undefined}
                    value={communityName}
                    onChange={(e) => setCommunityName(e.target.value)}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">{t('description')}</Text>
                <TextField
                    disabled={createdCommunityUri !== undefined}
                    value={communityDescription}
                    onChange={(e) => setCommunityDescription(e.target.value)}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">{t('addToList')}</Text>
                <Suspense fallback={<Text>Loading...</Text>}>
                    <CommunityListSelect
                        disabled={isSubmitting}
                        selected={selectedListUri}
                        onChange={setSelectedListUri}
                    />
                </Suspense>
            </div>
            {error && <Text style={{ color: '#ff5b5b' }}>{error}</Text>}
        </div>
    )
}

const CommunityListSelect = ({
    disabled,
    selected,
    onChange
}: {
    disabled: boolean
    selected?: string
    onChange: (uri: string) => void
}) => {
    const { client } = useClient()
    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const defaultList = pinnedLists.find((pin) => pin.defaultPostHome) ?? pinnedLists[0]

    return (
        <select
            disabled={disabled}
            value={selected ?? defaultList?.uri ?? ''}
            onChange={(e) => onChange(e.target.value)}
            style={{
                padding: '8px',
                fontSize: '16px',
                borderRadius: '4px',
                borderColor: CssVar.divider,
                backgroundColor: CssVar.contentBackground,
                color: CssVar.contentText,
                width: '100%',
                boxSizing: 'border-box'
            }}
        >
            {pinnedLists.map((pin) => (
                <CommunityListOption key={pin.uri} pin={pin} />
            ))}
        </select>
    )
}

const CommunityListOption = ({ pin }: { pin: PinnedListItemClass }) => {
    const [list] = useSubscribe(pin.list)
    if (!list) return null
    return <option value={pin.uri}>{list.title}</option>
}
