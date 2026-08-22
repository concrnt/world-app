import { useStack } from '../../../layouts/Stack'
import { MessageProps } from '../types'

import { ProfileView } from '../../../views/Profile'
import { PostView } from '../../../views/Post'

import { Avatar, CfmRenderer } from '@concrnt/ui'
import { MessageLayout } from '../MessageLayout'
import { CollapsibleBody } from '../CollapsibleBody'

export const LegacyNoteMessage = (props: MessageProps<any>) => {
    const { push } = useStack()

    const message = props.message
    const legacyMessage = JSON.parse(message.value.body)

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
                        push(<ProfileView ccid={message.author} profileName={message.authorProfileName ?? undefined} />)
                    }}
                >
                    <Avatar ccid={message.author} />
                </div>
            }
            headerLeft={
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <div
                        style={{
                            fontWeight: 'bold'
                        }}
                    >
                        {message.author.slice(0, 16)}...
                    </div>
                    <div>{new Date(message.createdAt).toLocaleString()}</div>
                </div>
            }
        >
            <CollapsibleBody forceExpanded={props.forceExpanded}>
                <CfmRenderer messagebody={legacyMessage.body} emojiDict={{}} />
            </CollapsibleBody>
            {/*
            <pre>
                {JSON.stringify(message, null, 2)}
            </pre>
            */}
        </MessageLayout>
    )
}
