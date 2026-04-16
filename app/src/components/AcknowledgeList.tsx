import { useEffect, useState } from 'react'
import { Avatar, Tab, Tabs, Text } from '@concrnt/ui'
import { User } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'
import { AcknowledgeButton } from './AcknowledgeButton'
import { useStack } from '../layouts/Stack'
import { ProfileView } from '../views/Profile'

interface Props {
    targetCcid: string
    initialTab?: 'acknowledging' | 'acknowledgers'
}

export const AcknowledgeList = (props: Props) => {
    const { client } = useClient()
    const stack = useStack()

    const [tab, setTab] = useState<'acknowledging' | 'acknowledgers'>(props.initialTab ?? 'acknowledging')

    const [acknowledgingUsers, setAcknowledgingUsers] = useState<User[] | null>(null)
    const [acknowledgersUsers, setAcknowledgersUsers] = useState<User[] | null>(null)

    useEffect(() => {
        let unmounted = false
        if (!client) return

        // Acknowledging: acks[i].associate === 'cckv://${対象ccid}' → ccidを抽出
        client.getAcknowledging(props.targetCcid).then(async (acks) => {
            const ccids = acks.map((a) => a.associate.replace('cckv://', ''))
            const users = await Promise.all(ccids.map((ccid) => client.getUser(ccid)))
            if (unmounted) return
            setAcknowledgingUsers(users.filter((u): u is User => u !== null))
        })

        // Acknowledgers: acks[i].author がフォロワーのccid
        client.getAcknowledgers(props.targetCcid).then(async (acks) => {
            const ccids = acks.map((a) => a.author)
            const users = await Promise.all(ccids.map((ccid) => client.getUser(ccid)))
            if (unmounted) return
            setAcknowledgersUsers(users.filter((u): u is User => u !== null))
        })

        return () => {
            unmounted = true
        }
    }, [client, props.targetCcid])

    const users = tab === 'acknowledging' ? acknowledgingUsers : acknowledgersUsers

    const openProfile = (ccid: string) => {
        stack.push(<ProfileView id={ccid} />)
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflow: 'hidden'
            }}
        >
            <Tabs>
                <Tab
                    selected={tab === 'acknowledging'}
                    onClick={() => setTab('acknowledging')}
                    groupId="acknowledge-list-tabs"
                    style={{ color: CssVar.contentText }}
                >
                    フォロー
                </Tab>
                <Tab
                    selected={tab === 'acknowledgers'}
                    onClick={() => setTab('acknowledgers')}
                    groupId="acknowledge-list-tabs"
                    style={{ color: CssVar.contentText }}
                >
                    フォロワー
                </Tab>
            </Tabs>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: CssVar.space(2)
                }}
            >
                {users === null ? (
                    <Text variant="caption">Loading...</Text>
                ) : users.length === 0 ? (
                    <Text variant="caption">No users</Text>
                ) : (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2)
                        }}
                    >
                        {users.map((user) => (
                            <div
                                key={user.ccid}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: CssVar.space(1)
                                }}
                            >
                                <Avatar
                                    ccid={user.ccid}
                                    src={user.profile?.avatar}
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                    onClick={() => openProfile(user.ccid)}
                                />
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1,
                                        minWidth: 0,
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => openProfile(user.ccid)}
                                >
                                    <Text variant="h6">{user.profile?.username || 'anonymous'}</Text>
                                    <Text
                                        variant="caption"
                                        style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical'
                                        }}
                                    >
                                        {user.profile?.description || ''}
                                    </Text>
                                </div>
                                <AcknowledgeButton ccid={user.ccid} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
