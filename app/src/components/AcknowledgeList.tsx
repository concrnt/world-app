import { Suspense, use, useMemo, useState } from 'react'
import { Avatar, Tab, Tabs, Text } from '@concrnt/ui'
import { isNonNullOrUndefined, User } from '@concrnt/worldlib'
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

    const [tab, setTab] = useState<'acknowledging' | 'acknowledgers'>(props.initialTab ?? 'acknowledging')

    // TODO: ユーザーへの変換はリスト上の個々のコンポーネントで行う
    const acknowledgingUsersPromise = useMemo(() => {
        if (!client) return Promise.resolve(null)
        return client.getAcknowledging(props.targetCcid).then(async (acks) => {
            const ccids = acks
                .map((a) => a.associate)
                .filter(isNonNullOrUndefined)
                .map((uri) => uri.replace('cckv://', ''))
            const users = await Promise.all(ccids.map((ccid) => client.getUser(ccid)))
            return users.filter((u): u is User => u !== null)
        })
    }, [client, props.targetCcid])

    const acknowledgersUsersPromise = useMemo(() => {
        if (!client) return Promise.resolve(null)
        return client.getAcknowledgers(props.targetCcid).then(async (acks) => {
            const ccids = acks.map((a) => a.author)
            const users = await Promise.all(ccids.map((ccid) => client.getUser(ccid)))
            return users.filter((u): u is User => u !== null)
        })
    }, [client, props.targetCcid])

    const users = tab === 'acknowledging' ? acknowledgingUsersPromise : acknowledgersUsersPromise

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
            <Suspense
                key={tab + props.targetCcid}
                fallback={
                    <div style={{ padding: CssVar.space(2) }}>
                        <Text variant="caption">Loading...</Text>
                    </div>
                }
            >
                <UserList usersPromise={users} />
            </Suspense>
        </div>
    )
}

const UserList = (props: { usersPromise: Promise<User[] | null> }) => {
    const stack = useStack()
    const openProfile = (ccid: string) => {
        stack.push(<ProfileView id={ccid} />)
    }

    const users = use(props.usersPromise)

    // TODO: ユーザーの表示をコンポーネント化する
    return (
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
    )
}
