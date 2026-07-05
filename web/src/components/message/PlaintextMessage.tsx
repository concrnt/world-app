import { MessageProps } from './types'
import { PlaintextMessageSchema } from '@concrnt/worldlib'

import { Avatar } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { MessageFooter } from './Footer'

export const PlaintextMessage = (props: MessageProps<PlaintextMessageSchema>) => {
    const navigate = useNavigate()

    const message = props.message

    return (
        <MessageLayout
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
                    <Avatar ccid={message.author} src={message.authorProfile?.avatar} />
                </div>
            }
            headerLeft={
                <div
                    style={{
                        fontWeight: 'bold'
                    }}
                >
                    {message.authorProfile?.username || 'Anonymous'}
                </div>
            }
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            {/* plaintextはマークダウン・絵文字のレンダリングを行わずそのまま表示する */}
            <div
                style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere'
                }}
            >
                {message.value.body}
            </div>
            <MessageFooter message={message} />
        </MessageLayout>
    )
}
