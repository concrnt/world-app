import { CommunityTimelineSchema, List, Schemas, semantics, type List as ListType } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Text, Button, TextField } from '@concrnt/ui'
import { Document, NotFoundError } from '@concrnt/client'
import { useEffect, useState, useRef, useTransition, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../components/Drawer'
import { MdAdd } from 'react-icons/md'
import { useHaptics } from '../contexts/Haptics'
import { SearchExplorer } from '../components/SearchExplorer'
import { CssVar } from '../types/Theme'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { FAB } from '../components/FAB'
import { usePersistent } from '../hooks/usePersistent'
import { invalidateResource } from '../hooks/useResource'
import { ClassicExplorer } from '../components/ClassicExplorer'
import { useNavigate } from 'react-router-dom'

interface CommunityDraft {
    name: string
    description: string
    selectedListUri?: string | null
    communityUri?: string
    createdCommunityUri?: string
}

interface AvailableList {
    uri: string
    title: string
    list: ListType
    defaultPostHome: boolean
}

const emptyCommunityDraft: CommunityDraft = { name: '', description: '' }

export const ExplorerView = () => {
    const [creatorOpen, setCreatorOpen] = useState(false)
    const [communityDraft, setCommunityDraft] = useState<CommunityDraft>(emptyCommunityDraft)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const navigate = useNavigate()
    const scrollRef = useRef<HTMLDivElement>(null)
    const { client } = useClient()

    const [preferredClassicMode, setPreferredClassicMode] = usePersistent('explorer-classic-mode', false)
    const [, startModeTransition] = useTransition()
    const supportsSearchExplorer = client.server.layer === 'concrnt-mainnet'
    const classicMode = supportsSearchExplorer ? preferredClassicMode : true
    const closeCreator = () => {
        setCreatorOpen(false)
        if (!communityDraft.communityUri) setCommunityDraft(emptyCommunityDraft)
    }

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
                                setCreatorOpen(true)
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
                <FAB
                    onClick={() => {
                        setCreatorOpen(true)
                    }}
                >
                    <MdAdd size={24} />
                </FAB>
                <Drawer open={creatorOpen} onClose={closeCreator}>
                    <CommunityCreator
                        draft={communityDraft}
                        setDraft={setCommunityDraft}
                        isSubmitting={isSubmitting}
                        setIsSubmitting={setIsSubmitting}
                        onComplete={(uri) => {
                            invalidateResource(`communities:${client.server.domain}`)
                            setCommunityDraft(emptyCommunityDraft)
                            setCreatorOpen(false)
                            navigate('/timeline/' + encodeURIComponent(uri))
                        }}
                    />
                </Drawer>
            </View>
        </>
    )
}

const CommunityCreator = ({
    draft,
    setDraft,
    isSubmitting,
    setIsSubmitting,
    onComplete
}: {
    draft: CommunityDraft
    setDraft: Dispatch<SetStateAction<CommunityDraft>>
    isSubmitting: boolean
    setIsSubmitting: Dispatch<SetStateAction<boolean>>
    onComplete: (uri: string) => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'views.explorer' })
    const { hapticSuccess } = useHaptics()
    const [error, setError] = useState<string>()
    const [availableLists, setAvailableLists] = useState<AvailableList[]>([])
    const [isListsLoading, setIsListsLoading] = useState(true)
    const [listLoadError, setListLoadError] = useState<string>()
    const [listReloadKey, setListReloadKey] = useState(0)
    const { client } = useClient()

    useEffect(() => {
        let cancelled = false
        const loadLists = async () => {
            setIsListsLoading(true)
            setListLoadError(undefined)
            await client.pinnedLists.refresh()
            const pins = client.pinnedLists.current
            if (!pins) throw new Error(t('listLoadFailed'))

            const lists = (
                await Promise.all(
                    pins.map(async (pin) => {
                        const list = await List.load(client, pin.uri, undefined, { cache: 'no-cache' }).catch((e) => {
                            if (e instanceof NotFoundError) return null
                            throw e
                        })
                        return list
                            ? {
                                  uri: pin.uri,
                                  title: list.title,
                                  list,
                                  defaultPostHome: pin.defaultPostHome
                              }
                            : undefined
                    })
                )
            ).filter((list): list is AvailableList => list !== undefined)
            if (cancelled) return

            setAvailableLists(lists)
            setDraft((current) => ({
                ...current,
                selectedListUri:
                    current.selectedListUri === null ||
                    (current.selectedListUri && lists.some((list) => list.uri === current.selectedListUri))
                        ? current.selectedListUri
                        : (lists.find((list) => list.defaultPostHome)?.uri ?? null)
            }))
            setIsListsLoading(false)
        }

        void loadLists().catch((e) => {
            if (cancelled) return
            console.error('Failed to load community lists', e)
            setAvailableLists([])
            setListLoadError(t('listLoadFailed'))
            setIsListsLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [client, listReloadKey, setDraft, t])

    const createCommunity = async (value: CommunityTimelineSchema) => {
        if (!client) return
        const uri = draft.communityUri ?? semantics.community(client.server.domain, Date.now().toString())
        setDraft((current) => ({ ...current, communityUri: uri }))
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
                    disabled={
                        !draft.name ||
                        isListsLoading ||
                        isSubmitting ||
                        (!!listLoadError && draft.selectedListUri != null)
                    }
                    onClick={async () => {
                        setIsSubmitting(true)
                        setError(undefined)
                        try {
                            const uri =
                                draft.createdCommunityUri ??
                                (await createCommunity({
                                    name: draft.name,
                                    description: draft.description
                                }))
                            if (!uri) return
                            setDraft((current) => ({ ...current, createdCommunityUri: uri }))

                            if (draft.selectedListUri) {
                                const selectedList = availableLists.find((list) => list.uri === draft.selectedListUri)
                                if (!selectedList) throw new Error(t('listUnavailable'))
                                await selectedList.list.addItem(client, uri, Schemas.communityTimeline)
                            }

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
                    {draft.createdCommunityUri ? t('retryAddToList') : t('create')}
                </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">{t('name')}</Text>
                <TextField
                    disabled={draft.createdCommunityUri !== undefined || isSubmitting}
                    value={draft.name}
                    onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">{t('description')}</Text>
                <TextField
                    disabled={draft.createdCommunityUri !== undefined || isSubmitting}
                    value={draft.description}
                    onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                <Text variant="h5">{t('addToList')}</Text>
                {isListsLoading ? (
                    <Text>{t('loading')}</Text>
                ) : listLoadError ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
                        <div role="alert">
                            <Text style={{ color: '#ff5b5b' }}>{listLoadError}</Text>
                        </div>
                        <Button variant="text" onClick={() => setListReloadKey((value) => value + 1)}>
                            {t('retryLists')}
                        </Button>
                    </div>
                ) : (
                    <CommunityListSelect
                        disabled={isSubmitting}
                        label={t('addToList')}
                        lists={availableLists}
                        selected={draft.selectedListUri}
                        onChange={(uri) => setDraft((current) => ({ ...current, selectedListUri: uri || null }))}
                    />
                )}
            </div>
            {error && (
                <div role="alert">
                    <Text style={{ color: '#ff5b5b' }}>{error}</Text>
                </div>
            )}
        </div>
    )
}

const CommunityListSelect = ({
    disabled,
    label,
    lists,
    selected,
    onChange
}: {
    disabled: boolean
    label: string
    lists: AvailableList[]
    selected?: string | null
    onChange: (uri: string) => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'views.explorer' })
    return (
        <select
            aria-label={label}
            disabled={disabled}
            value={selected ?? ''}
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
            <option value="">{t('doNotAddToList')}</option>
            {lists.map((list) => (
                <option key={list.uri} value={list.uri}>
                    {list.title}
                </option>
            ))}
        </select>
    )
}
