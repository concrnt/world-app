import { Suspense, use, useMemo, type CSSProperties } from 'react'

import { Avatar, Skeleton } from '@concrnt/ui'
import { User } from '@concrnt/worldlib'

import { useClient } from '../contexts/Client'

interface Props {
    ccid: string
    style?: CSSProperties
}

// CCIDからユーザーを解決してアバターを出す。
// PromiseはSuspense境界の外でCCIDごとに固定する(レンダーごとに作り直すと、transition中の再レンダーで
// 解決→再サスペンドを繰り返し、そのtransitionが永久に確定しなくなる)
export const CCUserAvatar = (props: Props) => {
    const { client } = useClient()
    const userPromise = useMemo(() => client.getUser(props.ccid), [client, props.ccid])

    return (
        <Suspense
            fallback={
                <Skeleton
                    width="40px"
                    height="40px"
                    style={{
                        display: 'block',
                        borderRadius: '4px',
                        ...props.style
                    }}
                />
            }
        >
            <Body {...props} userPromise={userPromise} />
        </Suspense>
    )
}

const Body = (props: Props & { userPromise: Promise<User | null> }) => {
    const user = use(props.userPromise)
    return <Avatar ccid={props.ccid} src={user?.profile.avatar} style={props.style} />
}
