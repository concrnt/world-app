import { Message, RerouteMessageSchema, Schemas } from '@concrnt/worldlib'
import { Avatar } from '@concrnt/ui'
import { TimelineTag } from '../TimelineTag'
import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { MdArrowForward, MdOutlineHome, MdReplay } from 'react-icons/md'
import { useClient } from '../../contexts/Client'

interface Props {
    message: Message<any>
    rerouted?: Message<RerouteMessageSchema>
}

export const PostedTimelines = (props: Props) => {
    const navigate = useNavigate()
    const { client } = useClient()

    const reroutedSame = useMemo(() => {
        if (!props.rerouted) return false
        const a = [...(props.message.distributes ?? [])].sort()
        const b = [...(props.rerouted.distributes ?? [])].sort()
        return a.length === b.length && a.every((uri, i) => uri === b[i])
    }, [props.message, props.rerouted])

    return (
        <>
            {props.message.distributes
                ?.filter((uri) => !(uri.startsWith('cckv://') && uri.endsWith('/home-timeline')))
                .map((uri) => (
                    <TimelineTag
                        key={uri}
                        uri={uri}
                        schemaFilter={Schemas.communityTimeline}
                        style={{
                            fontSize: '0.75rem'
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate('/timeline/' + encodeURIComponent(uri))
                        }}
                    />
                ))}
            {props.message.distributes
                ?.filter((uri) => uri.startsWith('cckv://') && uri.endsWith('/home-timeline'))
                .map((uri) =>
                    props.rerouted ? (
                        <span
                            key={uri}
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                            onClick={(e) => {
                                e.stopPropagation()
                                navigate('/profile/' + uri.split('/')[2])
                            }}
                        >
                            <Avatar
                                ccid={uri.split('/')[2]}
                                src={client.getUser(uri.split('/')[2]).then((user) => user?.profile.avatar)}
                                style={{ width: '16px', height: '16px' }}
                            />
                        </span>
                    ) : (
                        <MdOutlineHome
                            key={uri}
                            size={16}
                            onClick={(e) => {
                                e.stopPropagation()
                                navigate('/profile/' + uri.split('/')[2])
                            }}
                        />
                    )
                )}
            {props.rerouted &&
                (reroutedSame ? (
                    <MdReplay size={16} style={{ opacity: 0.7 }} />
                ) : (
                    <>
                        <MdArrowForward size={16} style={{ opacity: 0.7 }} />
                        {props.rerouted.distributes
                            ?.filter((uri) => !(uri.startsWith('cckv://') && uri.endsWith('/home-timeline')))
                            .map((uri) => (
                                <TimelineTag
                                    key={uri}
                                    uri={uri}
                                    schemaFilter={Schemas.communityTimeline}
                                    style={{
                                        fontSize: '0.75rem'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        navigate('/timeline/' + encodeURIComponent(uri))
                                    }}
                                />
                            ))}
                        {props.rerouted.distributes
                            ?.filter((uri) => uri.startsWith('cckv://') && uri.endsWith('/home-timeline'))
                            .map((uri) => (
                                <span
                                    key={uri}
                                    style={{ display: 'inline-flex', alignItems: 'center' }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        navigate('/profile/' + uri.split('/')[2])
                                    }}
                                >
                                    <Avatar
                                        ccid={uri.split('/')[2]}
                                        src={client.getUser(uri.split('/')[2]).then((user) => user?.profile.avatar)}
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                </span>
                            ))}
                    </>
                ))}
        </>
    )
}
