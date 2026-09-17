import { User } from '@concrnt/worldlib'
import { Avatar } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useClient } from '../../contexts/Client'

interface Props {
    author: string
    // APブリッジ経由のいいね/リアクションはprofileOverrideに元のプロフィールが入っている
    profileOverride?: {
        username?: string
        avatar?: string
    }
}

// いいね/リアクションした人をtooltip内に1行で表示する
export const AssociationUserRow = (props: Props) => {
    const { client } = useClient()
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        client?.getUser(props.author).then((u) => setUser(u))
    }, [props.author, client])

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Avatar
                ccid={props.author}
                src={props.profileOverride?.avatar ?? user?.profile.avatar}
                style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '12px' }}>
                {props.profileOverride?.username ?? user?.profile.username ?? 'Anonymous'}
            </span>
        </div>
    )
}
