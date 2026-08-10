import { Association, Message, ReactionAssociationSchema, RerouteMessageSchema, Schemas } from '@concrnt/worldlib'
import { useOptimistic } from 'react'
import { MessageActions } from './MessageActions'
import { MessageReactions } from './MessageReactions'
import { PostedTimelines } from './PostedTimelines'
import { CssVar, Text } from '@concrnt/ui'
import { useClient } from '../../contexts/Client'
import { usePreference } from '../../contexts/Preference'

interface Props {
    message: Message<any>
    rerouted?: Message<RerouteMessageSchema>
}

export interface ReactionState {
    reactionCounts: Record<string, number>
    ownReactions: Record<string, Association<ReactionAssociationSchema>>
}

export const MessageFooter = (props: Props) => {
    const { client } = useClient()
    const [devmode] = usePreference('developerMode')
    const [reactionState, updateReactionState] = useOptimistic<ReactionState>(
        (() => {
            const reactionCounts = props.message.reactionCounts ?? {}
            const ownReactions: Record<string, Association<ReactionAssociationSchema>> = {}
            for (const assoc of props.message.ownAssociations) {
                if (assoc.schema === Schemas.reactionAssociation) {
                    const value = assoc.value as ReactionAssociationSchema
                    ownReactions[value.imageUrl] = assoc as Association<ReactionAssociationSchema>
                }
            }
            return { reactionCounts, ownReactions }
        })()
    )

    return (
        <>
            {devmode && <Text variant="caption">{props.message.uri}</Text>}
            <MessageReactions
                message={props.message}
                rerouted={props.rerouted}
                reactionState={reactionState}
                updateReactionState={updateReactionState}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    justifyContent: 'space-between',
                    alignItems: 'stretch',
                    flexWrap: 'wrap',
                    gap: CssVar.space(1)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}
                >
                    <PostedTimelines message={props.message} rerouted={props.rerouted} />
                </div>
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        marginLeft: `calc(${CssVar.space(2)} * -1)`
                    }}
                >
                    {/* ゲスト(未ログイン)はEmojiPickerProvider等が無いため、アクション群自体を描画しない */}
                    {client.ccid !== '' && (
                        <MessageActions
                            message={props.message}
                            rerouted={props.rerouted}
                            updateReactionState={updateReactionState}
                        />
                    )}
                </div>
            </div>
        </>
    )
}
