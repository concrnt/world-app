import { Text, CssVar } from '@concrnt/ui'
import { use, useMemo } from 'react'
import type { Message } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import { getCommunityDestinations } from './utils'

export const MessageDestinations = (props: { message: Message<unknown> }) => {
    const { client } = useClient()
    const hasHomeDestination = props.message.distributes?.some((uri) => uri.includes('/home-timeline'))
    const labelsPromise = useMemo(() => {
        const targets = getCommunityDestinations(props.message)
        if (!client || targets.length === 0) {
            return Promise.resolve([] as string[])
        }

        return Promise.all(
            targets.map(async (uri) => {
                const timeline = await client.getTimeline(uri)
                return timeline?.name ?? uri
            })
        )
    }, [client, props.message])
    const labels = use(labelsPromise)

    if (labels.length === 0 && !hasHomeDestination) {
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
