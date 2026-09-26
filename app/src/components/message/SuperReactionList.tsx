import {
    Association,
    Message,
    Schemas,
    type SuperreactionAssociationSchema,
    type UpgradeAssociationSchema
} from '@concrnt/worldlib'
import { useClient } from '../../contexts/Client'
import { useResource } from '../../hooks/useResource'
import { SuperReactionItem, type SuperReactionPair } from './SuperReactionItem'

interface Props {
    message: Message<any>
}

// メッセージに付いた superreaction と upgrade(tx hash)を取得して組にする。
// Message.load は自分の association しか持たないため、ここで全件を引く。
// キーに件数を含めることで、新着(socket → getMessage 再取得で counts 更新)時に再取得される
export const SuperReactionList = (props: Props) => {
    const { client } = useClient()
    const message = props.message
    const counts = message.associationCounts ?? {}
    const srCount = counts[Schemas.superreactionAssociation] ?? 0
    const upCount = counts[Schemas.upgradeAssociation] ?? 0

    const pairs = useResource<SuperReactionPair[]>(`superreactions:${message.uri}:${srCount}:${upCount}`, async () => {
        const [srDocs, upDocs] = await Promise.all([
            client.api.getAssociationsAll(message.uri, { schema: Schemas.superreactionAssociation }, message.hint),
            client.api.getAssociationsAll(message.uri, { schema: Schemas.upgradeAssociation }, message.hint)
        ])
        const superreactions = srDocs.map((sd) =>
            Association.fromSignedDocument(sd)
        ) as Association<SuperreactionAssociationSchema>[]
        const upgrades = upDocs.map((sd) =>
            Association.fromSignedDocument(sd)
        ) as Association<UpgradeAssociationSchema>[]
        const result: SuperReactionPair[] = []
        for (const sr of superreactions) {
            // upgrade は同じ人が同じ superreaction を指しているものだけ採用(他人が勝手に紐づけられない)
            const up = upgrades.find((u) => u.value.target === sr.ccfs && u.author === sr.author)
            if (!up) continue
            const profile = await sr.loadAuthorProfile(client, message.hint).catch(() => undefined)
            result.push({
                ccfs: sr.ccfs,
                author: sr.author,
                associate: sr.associate,
                txhash: up.value.txhash,
                username: profile?.username || 'Anonymous',
                avatar: profile?.avatar,
                imageUrl: sr.value.imageUrl,
                message: sr.value.message,
                declaredAmount: sr.value.amount,
                // fromSignedDocument 経由の createdAt は JSON 文字列のまま(Date ではない)
                createdAt: new Date(sr.createdAt).getTime()
            })
        }
        result.sort((a, b) => a.createdAt - b.createdAt)
        return result
    })

    if (pairs.length === 0) return null
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}
        >
            {pairs.map((pair) => (
                <SuperReactionItem key={pair.ccfs} pair={pair} receiverDomain={message.authorUser?.domain} />
            ))}
        </div>
    )
}
