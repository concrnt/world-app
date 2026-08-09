import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { PlaintextMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageAuthor } from './MessageAuthor'
import { TimeDiff } from '../TimeDiff'
import { MessageFooter } from './Footer'
import { CollapsibleBody } from './CollapsibleBody'

export const PlaintextMessage = (props: MessageProps<PlaintextMessageSchema>) => {
    const { push } = useStack()

    const message = props.message

    return (
        <MessageLayout
            detail={props.detail}
            onClick={() => {
                push(<PostView uri={message.uri} />)
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<ProfileView ccid={message.author} />)
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
