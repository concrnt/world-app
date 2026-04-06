import { Button } from '@concrnt/ui'
import { Schemas, type Message } from '@concrnt/worldlib'

import { MdStar } from 'react-icons/md'
import { MdStarOutline } from 'react-icons/md'
import { MdReply } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { useClient } from '../../contexts/Client'
import { useComposer } from '../../contexts/Composer'

interface Props {
    message: Message<any>
}

export const MessageActions = (props: Props) => {
    const { client } = useClient()
    const composer = useComposer()

    const ownFavorite = props.message.ownAssociations.find((a) => a.schema === Schemas.likeAssociation)
    const likeCount = props.message.associationCounts?.[Schemas.likeAssociation] ?? 0
    const replyCount = props.message.associationCounts?.[Schemas.replyAssociation] ?? 0
    const rerouteCount = props.message.associationCounts?.[Schemas.rerouteAssociation] ?? 0

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                alignItems: 'center'
            }}
        >
            {/* リプライボタン */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    composer.open([], [], 'reply', props.message)
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <MdReply size={20} />
                {replyCount > 0 && <span style={{ marginLeft: '4px' }}>{replyCount}</span>}
            </Button>

            {/* リルートボタン */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    composer.open([], [], 'reroute', props.message)
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <MdRepeat size={20} />
                {rerouteCount > 0 && <span style={{ marginLeft: '4px' }}>{rerouteCount}</span>}
            </Button>

            {/* いいねボタン */}
            <Button
                variant="text"
                onClick={(e) => {
                    e.stopPropagation()
                    if (!client) return
                    if (ownFavorite) {
                        //client?.unfavorite(message)
                    } else {
                        props.message.favorite(client)
                    }
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                {ownFavorite ? <MdStar size={20} color="gold" /> : <MdStarOutline size={20} />}
                <span style={{ marginLeft: '4px' }}>{likeCount}</span>
            </Button>
        </div>
    )
}
