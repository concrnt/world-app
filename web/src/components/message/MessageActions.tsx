import { Button } from '@concrnt/ui'
import { Schemas, type Message } from '@concrnt/worldlib'
import { MdMoreHoriz, MdReply, MdRepeat, MdStar, MdStarOutline } from 'react-icons/md'
import { useClient } from '../../contexts/Client'
import { useComposerLauncher } from '../../contexts/Composer'
import { getCommunityDestinations } from './common'

export const MessageActions = (props: { message: Message<unknown> }) => {
    const { client } = useClient()
    const composer = useComposerLauncher()

    const ownFavorite = props.message.ownAssociations.find((association) => association.schema === Schemas.likeAssociation)
    const likeCount = props.message.associationCounts?.[Schemas.likeAssociation] ?? 0
    const replyCount = props.message.associationCounts?.[Schemas.replyAssociation] ?? 0
    const rerouteCount = props.message.associationCounts?.[Schemas.rerouteAssociation] ?? 0
    const communityDestinations = getCommunityDestinations(props.message)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}
        >
            <Button
                variant="text"
                onClick={(event) => {
                    event.stopPropagation()
                    composer.setAdditionalDestinations(communityDestinations)
                    composer.open('reply', props.message)
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <MdReply size={20} />
                {replyCount > 0 && <span style={{ marginLeft: '4px' }}>{replyCount}</span>}
            </Button>

            <Button
                variant="text"
                onClick={(event) => {
                    event.stopPropagation()
                    composer.setAdditionalDestinations(communityDestinations)
                    composer.open('reroute', props.message)
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <MdRepeat size={20} />
                {rerouteCount > 0 && <span style={{ marginLeft: '4px' }}>{rerouteCount}</span>}
            </Button>

            <Button
                variant="text"
                onClick={(event) => {
                    event.stopPropagation()
                    if (!client) return

                    if (ownFavorite) {
                        void client.api.delete(ownFavorite.ccfs)
                    } else {
                        void props.message.favorite(client)
                    }
                }}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                {ownFavorite ? <MdStar size={20} color="gold" /> : <MdStarOutline size={20} />}
                <span style={{ marginLeft: '4px' }}>{likeCount}</span>
            </Button>

            <Button
                variant="text"
                onClick={async (event) => {
                    event.stopPropagation()
                    if (!client) return

                    if (props.message.author === client.ccid) {
                        if (window.confirm('この投稿を削除しますか？')) {
                            await client.api.delete(props.message.uri)
                        }
                        return
                    }

                    const reason = window.prompt('通報理由を入力してください')
                    if (!reason) return

                    const parsed = new URL(props.message.uri)
                    const entity = await client.api.getEntity(parsed.host)
                    await client.api.callConcrntApi(entity.value.domain, 'net.concrnt.core.abuse', {}, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            target: props.message.uri,
                            body: reason
                        })
                    })
                }}
            >
                <MdMoreHoriz size={20} />
            </Button>
        </div>
    )
}
