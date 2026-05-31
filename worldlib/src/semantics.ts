export const semantics = {
    user: (ccid: string) => `cckv://${ccid}`,
    settings: (owner: string) => `cckv://${owner}/concrnt.world/settings`,
    themes: (owner: string) => `cckv://${owner}/concrnt.world/themes`,
    emojipacks: (owner: string) => `cckv://${owner}/concrnt.world/emojipacks`,
    profile: (owner: string, profile: string) => `cckv://${owner}/concrnt.world/profiles/${profile}`,
    profiles: (owner: string) => `cckv://${owner}/concrnt.world/profiles`,
    lists: (owner: string, profile: string) => `cckv://${owner}/concrnt.world/profiles/${profile}/lists`,
    list: (owner: string, profile: string, listId: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile}/lists/${listId}`,
    homeTimeline: (owner: string, profile: string) => `cckv://${owner}/concrnt.world/profiles/${profile}/home-timeline`,
    notificationTimeline: (owner: string, profile: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile}/notify-timeline`,
    activityTimeline: (owner: string, profile: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile}/activity-timeline`,
    postsParnet: (owner: string, profile: string) => `cckv://${owner}/concrnt.world/profiles/${profile}/posts`,
    post: (owner: string, profile: string, postId: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile}/posts/${postId}`,

    communities: (domain: string) => `cckv://${domain}/concrnt.world/communities`,
    community: (domain: string, communityId: string) => `cckv://${domain}/concrnt.world/communities/${communityId}`,

    subkey: (owner: string, ckid: string) => `cckv://${owner}/keys/${ckid}`,
    blocks: (owner: string) => `cckv://${owner}/.concrnt/blocking`,
    block: (owner: string, target: string) => `cckv://${owner}/.concrnt/blocking/${target}`
}
