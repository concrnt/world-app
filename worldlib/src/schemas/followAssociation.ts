// フォロー通知用の association スキーマ (#96)
// 形は likeAssociation に倣う。正式な JSON schema が用意されたら
// json-schema-to-typescript で再生成して置き換える想定。

export interface FollowAssociationSchema {
    profileOverride?: {
        username?: string
        avatar?: string
        description?: string
        link?: string
        profileID?: string
    }
}
