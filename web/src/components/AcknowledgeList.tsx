import { Suspense, use, useMemo, useState } from 'react'
import { Avatar, CssVar, Tab, Tabs, Text } from '@concrnt/ui'
import { isNonNullOrUndefined, type User } from '@concrnt/worldlib'
import { useNavigate } from 'react-router-dom'
import { AcknowledgeButton } from './AcknowledgeButton'
import { useClient } from '../contexts/Client'

interface Props {
    targetCcid: string
    initialTab?: 'acknowledging' | 'acknowledgers'
}

export const AcknowledgeList = (props: Props) => {
    const { client } = useClient()
    const [tab, setTab] = useState<'acknowledging' | 'acknowledgers'>(props.initialTab ?? 'acknowledging')

    const acknowledgingUsersPromise = useMemo(() => {
        if (!client) return Promise.resolve<User[] | null>(null)

        return client.getAcknowledging(props.targetCcid).then(async (acknowledges) => {
            const ccids = acknowledges
                .map((acknowledge) => acknowledge.associate)
                .filter(isNonNullOrUndefined)
                .map((uri) => uri.replace('cckv://', ''))

            const users = await Promise.all(ccids.map((ccid) => client.getUser(ccid)))
            return users.filter((user): user is User => user !== null)
        })
    }, [client, props.targetCcid])

    const acknowledgersUsersPromise = useMemo(() => {
        if (!client) return Promise.resolve<User[] | null>(null)

        return client.getAcknowledgers(props.targetCcid).then(async (acknowledges) => {
            const users = await Promise.all(acknowledges.map((acknowledge) => client.getUser(acknowledge.author)))
            return users.filter((user): user is User => user !== null)
        })
    }, [client, props.targetCcid])

    const usersPromise = tab === 'acknowledging' ? acknowledgingUsersPromise : acknowledgersUsersPromise

    return (
        <div
            style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Tabs
                style={{
                    paddingInline: CssVar.space(2),
                    borderBottom: `1px solid ${CssVar.divider}`
                }}
            >
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
                key={`${tab}:${props.targetCcid}`}
                fallback={<Status label="ユーザー一覧を読み込んでいます..." />}
            >
                <UserList usersPromise={usersPromise} />
            </Suspense>
        </div>
    )
}

const UserList = (props: { usersPromise: Promise<User[] | null> }) => {
    const navigate = useNavigate()
    const users = use(props.usersPromise)

    if (users === null) {
        return <Status label="ユーザー一覧を読み込んでいます..." />
    }

    if (users.length === 0) {
        return <Status label="まだユーザーがいません。" />
    }

    return (
        <div
            style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(3),
                padding: CssVar.space(4)
            }}
        >
            {users.map((user) => (
                <div
                    key={user.ccid}
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: CssVar.space(3)
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate(`/profile/${encodeURIComponent(user.ccid)}`)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(3),
                            padding: 0,
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: CssVar.contentText,
                            textAlign: 'left',
                            cursor: 'pointer',
                            flex: 1,
                            minWidth: 0
                        }}
                    >
                        <Avatar
                            ccid={user.ccid}
                            src={user.profile?.avatar}
                            style={{
                                width: '48px',
                                height: '48px',
                                flexShrink: 0
                            }}
                        />
                        <div
                            style={{
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(1)
                            }}
                        >
                            <Text variant="h3">{user.profile?.username || 'anonymous'}</Text>
                            <Text
                                variant="caption"
                                style={{
                                    opacity: 0.78,
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
                    </button>
                    <AcknowledgeButton ccid={user.ccid} />
                </div>
            ))}
        </div>
    )
}

const Status = (props: { label: string }) => {
    return (
        <div
            style={{
                flex: 1,
                minHeight: '160px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: CssVar.space(4),
                textAlign: 'center'
            }}
        >
            <Text style={{ opacity: 0.72 }}>{props.label}</Text>
        </div>
    )
}
