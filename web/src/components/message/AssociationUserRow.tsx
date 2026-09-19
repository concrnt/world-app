import { Association, ProfileSchema } from '@concrnt/worldlib'
import { Avatar } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useClient } from '../../contexts/Client'

interface Props {
    association: Association<any>
}

// いいね/リアクションした人をtooltip内に1行で表示する
// (サブプロフィール(profileURI)やAPブリッジのprofileOverrideの解決はAssociation側に任せる)
export const AssociationUserRow = (props: Props) => {
    const { client } = useClient()
    const [profile, setProfile] = useState<ProfileSchema | null>(null)

    useEffect(() => {
        if (!client) return
        props.association.loadAuthorProfile(client).then((p) => setProfile(p))
    }, [props.association, client])

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Avatar ccid={props.association.author} src={profile?.avatar} style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: '12px' }}>{profile?.username ?? 'Anonymous'}</span>
        </div>
    )
}
