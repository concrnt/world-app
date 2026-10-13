import { Message, RerouteMessageSchema, Schemas } from '@concrnt/worldlib'
import { Avatar } from '@concrnt/ui'
import { TimelineTag } from '../TimelineTag'
import { useStack } from '../../layouts/Stack'
import { TimelineView } from '../../views/Timeline'
import { ProfileView } from '../../views/Profile'
import { useMemo } from 'react'
import { MdArrowForward, MdOutlineHome, MdReplay } from 'react-icons/md'
import { SiActivitypub } from 'react-icons/si'
import { RiBlueskyLine } from 'react-icons/ri'
import { PiEmpty } from 'react-icons/pi'
import styles from './PostedTimelines.module.css'
import { isApInboxKey } from '../../utils/activitypub'
import { isBskyInboxKey } from '../../utils/bluesky'
import { useClient } from '../../contexts/Client'

interface Props {
    message: Message<any>
    rerouted?: Message<RerouteMessageSchema>
}

// ブリッジの受信タイムライン(AP/Bluesky inbox)はTimelineTagのschema判定(community限定)で落ちて
// 投稿先に出なかったので、ホームアイコンと同じ要領でサービスのアイコンだけを出す
const BridgeInboxIcon = (props: { uri: string; onClick: (e: React.MouseEvent) => void }) => {
    if (isApInboxKey(props.uri)) return <SiActivitypub size={16} title="ActivityPub" onClick={props.onClick} />
    if (isBskyInboxKey(props.uri)) return <RiBlueskyLine size={16} title="Bluesky" onClick={props.onClick} />
    return null
}

const isBridgeInboxKey = (uri: string): boolean => isApInboxKey(uri) || isBskyInboxKey(uri)

export const PostedTimelines = (props: Props) => {
    const { push } = useStack()
    const { client } = useClient()

    const reroutedSame = useMemo(() => {
        if (!props.rerouted) return false
        const a = [...(props.message.distributes ?? [])].sort()
        const b = [...(props.rerouted.distributes ?? [])].sort()
        return a.length === b.length && a.every((uri, i) => uri === b[i])
    }, [props.message, props.rerouted])

    return (
        <>
            <span className={styles.group}>
                {props.message.distributes
                    ?.filter((uri) => !(uri.startsWith('cckv://') && uri.endsWith('/home-timeline')))
                    .map((uri) =>
                        isBridgeInboxKey(uri) ? (
                            <BridgeInboxIcon
                                key={uri}
                                uri={uri}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    push(<TimelineView uri={uri} />)
                                }}
                            />
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
                                    push(<TimelineView uri={uri} />)
                                }}
                            />
                        )
                    )}
                {props.message.distributes
                    ?.filter((uri) => uri.startsWith('cckv://') && uri.endsWith('/home-timeline'))
                    .map((uri) =>
                        props.rerouted ? (
                            <span
                                key={uri}
                                style={{ display: 'inline-flex', alignItems: 'center' }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    push(<ProfileView ccid={uri.split('/')[2]} />)
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
                                    push(<ProfileView ccid={uri.split('/')[2]} />)
                                }}
                            />
                        )
                    )}
                <PiEmpty className={styles.empty} size={16} style={{ opacity: 0.7 }} />
            </span>
            {props.rerouted &&
                (reroutedSame ? (
                    <MdReplay size={16} style={{ opacity: 0.7 }} />
                ) : (
                    <>
                        <MdArrowForward size={16} style={{ opacity: 0.7 }} />
                        <span className={styles.group}>
                            {props.rerouted.distributes
                                ?.filter((uri) => !(uri.startsWith('cckv://') && uri.endsWith('/home-timeline')))
                                .map((uri) =>
                                    isBridgeInboxKey(uri) ? (
                                        <BridgeInboxIcon
                                            key={uri}
                                            uri={uri}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                push(<TimelineView uri={uri} />)
                                            }}
                                        />
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
                                                push(<TimelineView uri={uri} />)
                                            }}
                                        />
                                    )
                                )}
                            {props.rerouted.distributes
                                ?.filter((uri) => uri.startsWith('cckv://') && uri.endsWith('/home-timeline'))
                                .map((uri) => (
                                    <span
                                        key={uri}
                                        style={{ display: 'inline-flex', alignItems: 'center' }}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            push(<ProfileView ccid={uri.split('/')[2]} />)
                                        }}
                                    >
                                        <Avatar
                                            ccid={uri.split('/')[2]}
                                            src={client.getUser(uri.split('/')[2]).then((user) => user?.profile.avatar)}
                                            style={{ width: '16px', height: '16px' }}
                                        />
                                    </span>
                                ))}
                            <PiEmpty className={styles.empty} size={16} style={{ opacity: 0.7 }} />
                        </span>
                    </>
                ))}
        </>
    )
}
