import type { Message } from '@concrnt/worldlib'

export const isSystemTimeline = (uri: string) => {
    return uri.includes('/home-timeline') || uri.includes('/activity-timeline') || uri.includes('/notify-timeline')
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
