import { Document, Policy } from '@concrnt/client'
import { Schemas, Timeline } from '@concrnt/worldlib'
import { Text } from '@concrnt/ui'
import { Button, CCWallpaper, Confirm, CssVar, IconButton, ListItem, Select, Tab, Tabs, TextField } from '@concrnt/ui'
import { MdMoreHoriz } from 'react-icons/md'
import { shareText } from '../lib/share'

import { useClient } from '../contexts/Client'
import { Suspense, use, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Subscription } from './Subscription'
import { ServerChip } from './ServerChip'
import { CCEditor } from './CCEditor'
import { PolicyEditor } from './PolicyEditor'
import { useMediaProxy } from '../contexts/MediaProxy'

interface Props {
    uri: string
    onDeleted?: () => void
}

export const TimelineSettings = (props: Props) => {
    const { client } = useClient()

    const timelinePromise = useMemo(() => client.getTimeline(props.uri), [client, props.uri])

    return (
        <Suspense>
            <Inner timelinePromise={timelinePromise} onDeleted={props.onDeleted} />
        </Suspense>
    )
}

interface InnerProps {
    timelinePromise: Promise<Timeline | null>
    onDeleted?: () => void
}

const Inner = (props: InnerProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.timelineSettings' })
    const { client } = useClient()
    const { getImageURL } = useMediaProxy()
    const timeline = use(props.timelinePromise)

    const [tab, setTab] = useState<'subscriptions' | 'settings'>('subscriptions')
    const [menuOpen, setMenuOpen] = useState(false)

    if (!timeline) {
        return <>Timeline not found.</>
    }

    const isMe = client.ccid === timeline.author

    // シェア用URLはデプロイ先ホストに関わらずconcrnt.world固定(OGP対応がconcrnt.worldのみのため)
    const shareURL = 'https://concrnt.world/timeline/' + encodeURIComponent(timeline.uri)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                width: '100%'
            }}
        >
            <CCWallpaper src={getImageURL(timeline.banner)}>
                <div
                    style={{
                        padding: CssVar.space(2)
                    }}
                >
                    <div
                        style={{
                            backgroundColor: CssVar.contentBackground,
                            padding: CssVar.space(2),
                            borderRadius: CssVar.space(1)
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(2)
                            }}
                        >
                            <Text variant="h2">{timeline.name}</Text>
                            <div style={{ flex: 1 }} />
                            <IconButton onClick={() => setMenuOpen(true)}>
                                <MdMoreHoriz size={24} />
                            </IconButton>
                        </div>
                        <div
                            style={{
                                marginTop: CssVar.space(1),
                                marginBottom: CssVar.space(1)
                            }}
                        >
                            <ServerChip uri={timeline.uri} />
                        </div>
                        <Text>{timeline.description}</Text>
                    </div>
                </div>
            </CCWallpaper>
            <Select
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                options={[
                    <ListItem
                        key="share"
                        onClick={() => {
                            shareText(shareURL, timeline.name).catch(() => {})
                            setMenuOpen(false)
                        }}
                    >
                        <Text>{t('share')}</Text>
                    </ListItem>
                ]}
            />
            <Tabs>
                <Tab
                    selected={tab === 'subscriptions'}
                    onClick={() => setTab('subscriptions')}
                    groupId="timeline-settings"
                    style={{
                        color: CssVar.contentText
                    }}
                >
                    <Text>Subscriptions</Text>
                </Tab>
                {isMe && (
                    <Tab
                        selected={tab === 'settings'}
                        onClick={() => setTab('settings')}
                        groupId="timeline-settings"
                        style={{
                            color: CssVar.contentText
                        }}
                    >
                        <Text>Settings</Text>
                    </Tab>
                )}
            </Tabs>
            <div
                style={{
                    padding: CssVar.space(2)
                }}
            >
                {tab === 'subscriptions' && <Subscription target={timeline.uri} />}
                {tab === 'settings' && <TimelineEditor timeline={timeline} onDeleted={props.onDeleted} />}
            </div>
        </div>
    )
}

interface EditorProps {
    timeline: Timeline
    onDeleted?: () => void
}

const TimelineEditor = (props: EditorProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.timelineSettings' })
    const { client } = useClient()
    const [schemaDraft, setSchemaDraft] = useState<string>()
    const [valueDraft, setValueDraft] = useState<any>()
    const [policyDraft, setPolicyDraft] = useState<Policy>()
    const [key, setKey] = useState<string>()
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

    useEffect(() => {
        client.api
            .getDocument<any>(props.timeline.uri)
            .then((timeline) => {
                if (!timeline) throw new Error('Timeline document not found')
                setKey(timeline.key)
                setValueDraft(timeline.value)
                setSchemaDraft(timeline.schema)
                setPolicyDraft(timeline.policy)
            })
            .catch((e) => {
                console.error(e)
                setKey(undefined)
                setValueDraft(undefined)
                setSchemaDraft(undefined)
                setPolicyDraft(undefined)
            })
    }, [props.timeline])

    const handleSave = () => {
        if (!key || !schemaDraft) return
        const document: Document<any> = {
            kind: 'record',
            key: key,
            schema: schemaDraft,
            value: valueDraft,
            author: client.ccid,
            createdAt: new Date(),
            policy: policyDraft
        }
        client.api.commit(document)
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4)
            }}
        >
            <Text variant="h3">{t('schema')}</Text>
            <TextField
                // error={!schemaDraft?.startsWith('https://')}
                // helperText={t('schemaDesc')}
                value={schemaDraft}
                onChange={(e) => {
                    setSchemaDraft(e.target.value)
                }}
            />
            <div>
                <Text variant="h3">{t('attributes')}</Text>
                <CCEditor
                    schemaURL={schemaDraft}
                    value={valueDraft}
                    setValue={(e) => {
                        setValueDraft(e)
                    }}
                />
            </div>
            <Text variant="h3">Policy</Text>
            <PolicyEditor policy={policyDraft} setPolicy={setPolicyDraft} />

            <Button onClick={handleSave}>Save</Button>

            {/* homeタイムライン等を誤って消せないよう、削除はコミュニティタイムラインに限定する */}
            {props.timeline.schema === Schemas.communityTimeline && (
                <Button variant="outlined" onClick={() => setDeleteConfirmOpen(true)}>
                    {t('deleteTimeline')}
                </Button>
            )}
            <Confirm
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                title={t('confirmDeleteTimeline')}
                description={t('confirmDeleteTimelineDescription')}
                confirmText={t('deleteTimeline')}
                onConfirm={() => {
                    client.api.delete(props.timeline.uri).then(() => {
                        client.knownCommunities.reload()
                        props.onDeleted?.()
                    })
                }}
            />
        </div>
    )
}
