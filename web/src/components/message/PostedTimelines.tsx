import { Message, RerouteMessageSchema, Schemas } from '@concrnt/worldlib'
import { Avatar } from '@concrnt/ui'
import { TimelineTag } from '../TimelineTag'
import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { MdArrowForward, MdHomeFilled, MdReplay } from 'react-icons/md'
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
            {props.message.distributes?.map((uri) =>
                uri.startsWith('cckv://') && uri.endsWith('/home-timeline') ? (
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
                        <MdHomeFilled
                            key={uri}
                            size={16}
                            onClick={(e) => {
                                e.stopPropagation()
                                navigate('/profile/' + uri.split('/')[2])
                            }}
                        />
                    )
                ) : (
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
                )
            )}
            {props.rerouted &&
                (reroutedSame ? (
                    <MdReplay size={16} style={{ opacity: 0.7 }} />
                ) : (
                    <>
                        <MdArrowForward size={16} style={{ opacity: 0.7 }} />
                        {props.rerouted.distributes?.map((uri) =>
                            uri.startsWith('cckv://') && uri.endsWith('/home-timeline') ? (
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
                            )
                        )}
                    </>
                ))}
        </>
    )
}
