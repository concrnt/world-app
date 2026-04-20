export const semantics = {
    user: (ccid: string) => `cckv://${ccid}`,
    profile: (owner: string, profile?: string) => `cckv://${owner}/concrnt.world/profiles/${profile ?? 'main'}`,
    homeList: (owner: string, profile?: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile ?? 'main'}/lists/home`,
    homeTimeline: (owner: string, profile?: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile ?? 'main'}/home-timeline`,
    notificationTimeline: (owner: string, profile?: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile ?? 'main'}/notify-timeline`,
    activityTimeline: (owner: string, profile?: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile ?? 'main'}/activity-timeline`,
    postsParnet: (owner: string, profile?: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile ?? 'main'}/posts`,
    post: (owner: string, profile: string, postId: string) =>
        `cckv://${owner}/concrnt.world/profiles/${profile}/posts/${postId}`,

    communities: (domain: string) => `cckv://${domain}/concrnt.world/communities`,
    community: (domain: string, communityId: string) => `cckv://${domain}/concrnt.world/communities/${communityId}`,

    subkey: (owner: string, ckid: string) => `cckv://${owner}/keys/${ckid}`
}
