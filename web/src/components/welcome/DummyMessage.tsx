import type { CSSProperties, ReactNode } from 'react'
import { Avatar, CfmRenderer, Text } from '@concrnt/ui'
import { MdMoreHoriz, MdOutlineAddReaction, MdRepeat, MdReply, MdStarOutline } from 'react-icons/md'
import { MessageLayout } from '../message/MessageLayout'
import { humanReadableTimeDiff } from '../../utils/humanReadableTimeDiff'
import { useIsMobile } from '../../hooks/useIsMobile'

interface Props {
    dummyId: string
    username: string
    body: string
    avatarURL?: string
    timestamp?: ReactNode
    hideActions?: boolean
    style?: CSSProperties
}

// APIを叩かないダミー投稿ビュー。welcomeページの装飾・デモタイムライン専用
export const DummyMessage = (props: Props) => {
    const isMobile = useIsMobile()
    const avatarSize = isMobile ? '38px' : '48px'

    return (
        <div style={props.style}>
            <MessageLayout
                left={
                    <Avatar
                        ccid={props.dummyId}
                        src={props.avatarURL}
                        style={{ width: avatarSize, height: avatarSize }}
                    />
                }
                headerLeft={
                    <Text
                        style={{
                            fontWeight: 700,
                            fontSize: isMobile ? '0.9rem' : '0.95rem'
                        }}
                    >
                        {props.username}
                    </Text>
                }
                headerRight={props.timestamp ?? <Text variant="caption">{humanReadableTimeDiff(new Date())}</Text>}
            >
                <CfmRenderer messagebody={props.body} emojiDict={{}} />
                {!props.hideActions && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            maxWidth: '400px',
                            opacity: 0.4,
                            pointerEvents: 'none'
                        }}
                    >
                        <MdReply size={18} />
                        <MdRepeat size={18} />
                        <MdStarOutline size={18} />
                        <MdOutlineAddReaction size={18} />
                        <MdMoreHoriz size={18} />
                    </div>
                )}
            </MessageLayout>
        </div>
    )
}
