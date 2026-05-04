import { Avatar, CfmRenderer, CssVar, Text } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import type { MarkdownMessageSchema } from '@concrnt/worldlib'
import type { MessageProps } from './types'
import { MessageActions } from './MessageActions'
import { MessageDestinations } from './common'
import { formatTimestamp } from './utils'

export const MarkdownMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const navigate = useNavigate()
    const message = props.message

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: CssVar.space(2)
            }}
        >
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation()
                    navigate(`/profile/${encodeURIComponent(message.author)}`)
                }}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
                <Avatar ccid={message.author} src={message.authorProfile.avatar} />
            </button>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    flex: 1,
                    minWidth: 0
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: CssVar.space(2),
                        flexWrap: 'wrap'
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate(`/profile/${encodeURIComponent(message.author)}`)}
                        style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            padding: 0,
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: CssVar.contentText
                        }}
                    >
                        {message.authorProfile.username}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/post/${encodeURIComponent(message.uri)}`)}
                        style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            padding: 0,
                            cursor: 'pointer',
                            color: CssVar.contentText,
                            opacity: 0.72
                        }}
                    >
                        <Text variant="caption">{formatTimestamp(message.createdAt)}</Text>
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => navigate(`/post/${encodeURIComponent(message.uri)}`)}
                    style={{
                        border: 'none',
                        backgroundColor: 'transparent',
                        padding: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: CssVar.contentText
                    }}
                >
                    <CfmRenderer messagebody={message.value.body} emojiDict={{}} />
                </button>
                <MessageDestinations message={message} />
                <MessageActions message={message} />
            </div>
        </div>
    )
}
