import { Avatar, CfmRenderer, CssVar, Text } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import type { LikeAssociationSchema } from '@concrnt/worldlib'
import type { MessageProps } from './types'
import { formatTimestamp } from './common'

export const LikeAssociation = (props: MessageProps<LikeAssociationSchema>) => {
    const navigate = useNavigate()
    const message = props.message
    const targetMessage = message.associationTarget

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2)
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: CssVar.space(2),
                    paddingLeft: `calc(40px + ${CssVar.space(2)})`,
                    opacity: 0.72
                }}
            >
                <Text variant="caption">{message.authorProfile.username} がお気に入りに登録しました</Text>
                <Text variant="caption">{formatTimestamp(message.createdAt)}</Text>
            </div>
            {targetMessage && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: CssVar.space(2)
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate(`/profile/${encodeURIComponent(targetMessage.author)}`)}
                        style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                    >
                        <Avatar ccid={targetMessage.author} src={targetMessage.authorProfile.avatar} />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/post/${encodeURIComponent(targetMessage.uri)}`)}
                        style={{
                            border: 'none',
                            backgroundColor: 'transparent',
                            textAlign: 'left',
                            padding: 0,
                            cursor: 'pointer',
                            color: CssVar.contentText,
                            flex: 1
                        }}
                    >
                        <Text>{targetMessage.authorProfile.username}</Text>
                        {'body' in (targetMessage.value as Record<string, unknown>) && (
                            <CfmRenderer
                                messagebody={String((targetMessage.value as Record<string, unknown>).body ?? '')}
                                emojiDict={{}}
                            />
                        )}
                    </button>
                </div>
            )}
        </div>
    )
}
