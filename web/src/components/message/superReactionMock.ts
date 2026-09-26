import { useSyncExternalStore } from 'react'

export interface SuperReactionMock {
    id: string
    messageUri: string
    imageUrl: string
    eth: string
    author: string
    username: string
    avatar?: string
    message?: string
}

let reactions: SuperReactionMock[] = []
const listeners = new Set<() => void>()

export const addSuperReaction = (reaction: SuperReactionMock): void => {
    reactions = [...reactions, reaction]
    for (const listener of listeners) listener()
}

const useSuperReactionStore = (): SuperReactionMock[] => {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        () => reactions
    )
}

export const useSuperReactions = (messageUri: string): SuperReactionMock[] => {
    return useSuperReactionStore().filter((reaction) => reaction.messageUri === messageUri)
}

export const useSuperReactionLog = (): SuperReactionMock[] => {
    return useSuperReactionStore().slice().reverse()
}
