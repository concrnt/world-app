import { useSyncExternalStore } from 'react'

export interface SuperReactionMock {
    id: string
    messageUri: string
    imageUrl: string
    eth: string
    author: string
    username: string
    avatar?: string
}

let reactions: SuperReactionMock[] = []
const listeners = new Set<() => void>()

export const addSuperReaction = (reaction: SuperReactionMock): void => {
    reactions = [...reactions, reaction]
    for (const listener of listeners) listener()
}

export const useSuperReactions = (messageUri: string): SuperReactionMock[] => {
    const all = useSyncExternalStore(
        (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        () => reactions
    )
    return all.filter((reaction) => reaction.messageUri === messageUri)
}
