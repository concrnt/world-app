import { Text, CssVar } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import type { Message } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'

export const isSystemTimeline = (uri: string) => {
    return (
        uri.includes('/home-timeline') ||
        uri.includes('/activity-timeline') ||
        uri.includes('/notify-timeline')
    )
}

export const getCommunityDestinations = (message: Message<unknown>) => {
    return (message.distributes ?? []).filter((uri) => !isSystemTimeline(uri))
}

export const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date)
}

export const extractMessageBody = (message: Message<unknown>) => {
    const value = message.value as Record<string, unknown>
    return typeof value.body === 'string' ? value.body : ''
}

export const MessageDestinations = (props: { message: Message<unknown> }) => {
    const { client } = useClient()
    const [labels, setLabels] = useState<string[]>([])

    useEffect(() => {
        const targets = getCommunityDestinations(props.message)
        if (!client || targets.length === 0) {
            setLabels([])
            return
        }

        let isCancelled = false

        void Promise.all(
            targets.map(async (uri) => {
                const timeline = await client.getTimeline(uri)
                return timeline?.name ?? uri
            })
        ).then((nextLabels) => {
            if (isCancelled) return
            setLabels(nextLabels)
        })

        return () => {
            isCancelled = true
        }
    }, [client, props.message])

    if (labels.length === 0 && !props.message.distributes?.some((uri) => uri.includes('/home-timeline'))) {
        return null
    }

    const displayLabels = labels.length > 0 ? labels : ['Home']

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: CssVar.space(1)
            }}
        >
            {displayLabels.map((label) => (
                <div
                    key={label}
                    style={{
                        padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                        borderRadius: CssVar.round(1),
                        border: `1px solid ${CssVar.divider}`,
                        fontSize: '0.75rem'
                    }}
                >
                    <Text variant="caption">{label}</Text>
                </div>
            ))}
        </div>
    )
}
