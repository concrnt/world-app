import { Document } from '@concrnt/client'
import { Timeline } from '@concrnt/worldlib'
import { Text } from '@concrnt/ui'
import { Button, CCWallpaper, CssVar, Tab, Tabs, TextField } from '@concrnt/ui'

import { useClient } from '../contexts/Client'
import { Suspense, use, useEffect, useMemo, useState } from 'react'
import { Subscription } from './Subscription'
import { CCEditor } from './CCEditor'

interface Props {
    uri: string
}

export const TimelineSettings = (props: Props) => {
    const { client } = useClient()

    const timelinePromise = useMemo(() => client.getTimeline(props.uri), [client, props.uri])

    return (
        <Suspense>
            <Inner timelinePromise={timelinePromise} />
        </Suspense>
    )
}

interface InnerProps {
    timelinePromise: Promise<Timeline | null>
}

const Inner = (props: InnerProps) => {
    const timeline = use(props.timelinePromise)

    const [tab, setTab] = useState<'subscriptions' | 'settings'>('subscriptions')

    if (!timeline) {
        return <>Timeline not found.</>
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
            <CCWallpaper src={timeline.banner}>
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
                        </div>
                        <Text>{timeline.description}</Text>
                    </div>
                </div>
            </CCWallpaper>
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
            </Tabs>
            {tab === 'subscriptions' && <Subscription target={timeline.uri} />}
            {tab === 'settings' && <TimelineEditor timeline={timeline} />}
        </div>
    )
}

interface EditorProps {
    timeline: Timeline
}

const TimelineEditor = (props: EditorProps) => {
    const { client } = useClient()
    const [schemaDraft, setSchemaDraft] = useState<string>()
    const [valueDraft, setValueDraft] = useState<any>()
    const [key, setKey] = useState<string>()

    useEffect(() => {
        client.api.getDocument<any>(props.timeline.uri).then((timeline) => {
            if (timeline) {
                setKey(timeline.key)
                setValueDraft(timeline.value)
                setSchemaDraft(timeline.schema)
            }
        })
    }, [props.timeline])

    const handleSave = () => {
        if (!key || !schemaDraft) return
        const document: Document<any> = {
            key: key,
            schema: schemaDraft,
            value: valueDraft,
            author: client.ccid,
            createdAt: new Date()
        }
        client.api.commit(document)
    }

    return (
        <>
            <Text variant="h3">スキーマ</Text>
            <TextField
                // error={!schemaDraft?.startsWith('https://')}
                // helperText={t('schemaDesc')}
                value={schemaDraft}
                onChange={(e) => {
                    setSchemaDraft(e.target.value)
                }}
            />
            <div>
                <Text variant="h3">属性</Text>
                <CCEditor
                    schemaURL={schemaDraft}
                    value={valueDraft}
                    setValue={(e) => {
                        setValueDraft(e)
                    }}
                />
            </div>
            <Button onClick={handleSave}>Save</Button>
        </>
    )
}
