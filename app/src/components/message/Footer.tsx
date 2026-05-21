import { Association, Message, ReactionAssociationSchema, Schemas } from '@concrnt/worldlib'
import { useOptimistic } from 'react'
import { MessageActions } from './MessageActions'
import { MessageReactions } from './MessageReactions'
import { PostedTimelines } from './PostedTimelines'
import { CssVar } from '@concrnt/ui'

interface Props {
    message: Message<any>
}

export interface ReactionState {
    reactionCounts: Record<string, number>
    ownReactions: Record<string, Association<ReactionAssociationSchema>>
}

export const MessageFooter = (props: Props) => {
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
            <MessageReactions
                message={props.message}
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
                    <PostedTimelines message={props.message} />
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
                    <MessageActions message={props.message} updateReactionState={updateReactionState} />
                </div>
            </div>
        </>
    )
}
