import { Association, Message, ReactionAssociationSchema, Schemas } from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import { CssVar } from '../../types/Theme'
import { useEmojiPicker } from '../../contexts/EmojiPicker'
import { hapticLight } from '../../utils/haptics'

interface Props {
    message: Message<any>
}

export const MessageReactions = (props: Props) => {
    const { client } = useClient()
    const emojiPicker = useEmojiPicker()

    const reactionCounts = props.message.reactionCounts
    if (!reactionCounts || Object.keys(reactionCounts).length === 0) {
        return null
    }

    // 自分のリアクションを imageUrl → Association のマップにする
    const ownReactions: Record<string, Association<ReactionAssociationSchema>> = {}
    for (const assoc of props.message.ownAssociations) {
        if (assoc.schema === Schemas.reactionAssociation) {
            const value = assoc.value as ReactionAssociationSchema
            ownReactions[value.imageUrl] = assoc as Association<ReactionAssociationSchema>
        }
    }

    const handleReactionClick = async (imageUrl: string) => {
        if (!client) return
        hapticLight()

        if (ownReactions[imageUrl]) {
            // 自分のリアクションを削除
            await ownReactions[imageUrl].delete(client).catch((e) => {
                console.error('Failed to delete reaction:', e)
            })
        } else {
            // 同じ絵文字でリアクションを追加
            let shortcode = ''
            for (const pkg of emojiPicker.packages) {
                const found = pkg.emojis.find((e) => e.imageURL === imageUrl)
                if (found) {
                    shortcode = found.shortcode
                    break
                }
            }
            if (!shortcode) {
                shortcode = imageUrl.split('/').pop()?.replace(/\.\w+$/, '') ?? 'emoji'
            }

            await props.message.reaction(client, shortcode, imageUrl).catch((e) => {
                console.error('Failed to add reaction:', e)
            })
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px'
            }}
        >
            {Object.entries(reactionCounts).map(([imageUrl, count]) => {
                const isOwn = !!ownReactions[imageUrl]
                return (
                    <button
                        key={imageUrl}
                        onClick={(e) => {
                            e.stopPropagation()
                            handleReactionClick(imageUrl)
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            border: isOwn
                                ? `1.5px solid ${CssVar.contentLink}`
                                : `1px solid ${CssVar.divider}`,
                            backgroundColor: isOwn
                                ? `rgb(from ${CssVar.contentLink} r g b / 0.15)`
                                : 'transparent',
                            cursor: 'pointer',
                            color: CssVar.contentText,
                            fontSize: '13px',
                            WebkitTapHighlightColor: 'transparent'
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt=""
                            style={{
                                height: '18px',
                                width: '18px',
                                objectFit: 'contain'
                            }}
                        />
                        <span>{count}</span>
                    </button>
                )
            })}
        </div>
    )
}
