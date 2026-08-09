import { MessageProps } from './types'
import { PlaintextMessageSchema } from '@concrnt/worldlib'

import { Avatar } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageAuthor } from './MessageAuthor'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { MessageFooter } from './Footer'
import { CollapsibleBody } from './CollapsibleBody'

export const PlaintextMessage = (props: MessageProps<PlaintextMessageSchema>) => {
    const navigate = useNavigate()

    const message = props.message

    return (
        <MessageLayout
            detail={props.detail}
            onClick={() => {
                navigate('/post/' + encodeURIComponent(message.uri))
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        navigate('/profile/' + message.author)
                    }}
                >
                    <Avatar
                        ccid={message.author}
                        src={message.authorProfile?.avatar}
                        style={{ width: '48px', height: '48px' }}
                    />
                </div>
            }
            headerLeft={<MessageAuthor message={message} />}
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            {/* plaintextはマークダウン・絵文字のレンダリングを行わずそのまま表示する */}
            <CollapsibleBody forceExpanded={props.forceExpanded}>
                <div
                    style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere'
                    }}
                >
                    {message.value.body}
                </div>
            </CollapsibleBody>
            <MessageFooter message={message} rerouted={props.rerouted} />
        </MessageLayout>
    )
}
