import { Suspense, use, useMemo, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { MdAlternateEmail } from 'react-icons/md'
import { IoIosCloseCircle } from 'react-icons/io'

import { Avatar, Chip } from '@concrnt/ui'
import { User } from '@concrnt/worldlib'

import { useClient } from '../contexts/Client'

export interface CCUserChipProps {
    ccid: string
    user?: User
    avatar?: boolean
    iconOverride?: ReactNode
    onDelete?: () => void
    style?: CSSProperties
}

export const CCUserChip = (props: CCUserChipProps) => {
    const { client } = useClient()

    const userPromise = useMemo(() => {
        return props.user ? Promise.resolve(props.user) : client.getUser(props.ccid)
    }, [props.ccid, props.user, client])

    return (
        <Suspense fallback={<Chip style={props.style}>...</Chip>}>
            <CCUserChipBody {...props} userPromise={userPromise} />
        </Suspense>
    )
}

interface BodyProps extends CCUserChipProps {
    userPromise: Promise<User | null>
}

const CCUserChipBody = (props: BodyProps) => {
    const navigate = useNavigate()
    const user = use(props.userPromise)

    const head = props.avatar ? (
        <Avatar
            ccid={props.ccid}
            src={user?.profile.avatar}
            style={{
                width: 20,
                height: 20
            }}
        />
    ) : (
        (props.iconOverride ?? <MdAlternateEmail size={16} />)
    )

    return (
        <Chip
            headElement={head}
            style={props.style}
            onClick={
                props.onDelete
                    ? undefined
                    : (e) => {
                          e.stopPropagation()
                          navigate('/profile/' + props.ccid)
                      }
            }
            tailElement={
                props.onDelete && (
                    <IoIosCloseCircle
                        size={16}
                        onClick={(e) => {
                            e.stopPropagation()
                            props.onDelete?.()
                        }}
                    />
                )
            }
        >
            {user?.profile.username ?? 'anonymous'}
        </Chip>
    )
}
