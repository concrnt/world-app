export const Schemas = {
    markdownMessage: 'https://schema.concrnt.world/m/markdown.json',
    replyMessage: 'https://schema.concrnt.world/m/reply.json',
    rerouteMessage: 'https://schema.concrnt.world/m/reroute.json',
    plaintextMessage: 'https://schema.concrnt.world/m/plaintext.json',
    mediaMessage: 'https://schema.concrnt.world/m/media.json',
    gfmMessage: 'https://schema.concrnt.world/m/gfm.json',
    mfmMessage: 'https://schema.concrnt.world/m/mfm.json',

    likeAssociation: 'https://schema.concrnt.world/a/like.json',
    mentionAssociation: 'https://schema.concrnt.world/a/mention.json',
    replyAssociation: 'https://schema.concrnt.world/a/reply.json',
    rerouteAssociation: 'https://schema.concrnt.world/a/reroute.json',
    reactionAssociation: 'https://schema.concrnt.world/a/reaction.json',
    readAccessRequestAssociation: 'https://schema.concrnt.world/a/readaccessrequest.json',

    profile: 'https://schema.concrnt.world/p/main.json',

    userTimeline: 'https://schema.concrnt.world/t/user.json',
    communityTimeline: 'https://schema.concrnt.world/t/community.json',

    list: 'https://schema.concrnt.world/s/list.json',

    pinnedLists: 'https://schema.concrnt.world/utils/pinnedLists.json',

    empty: 'https://schema.concrnt.world/empty.json'
} as const

export type Schema = (typeof Schemas)[keyof typeof Schemas]
