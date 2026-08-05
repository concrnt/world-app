import { CssVar, View } from '@concrnt/ui'
import { ApObject, apNoteKey } from '../utils/activitypub'
import { ActivitypubNote } from '../components/message/ActivitypubNote'
import { Suspense, useEffect, useState } from 'react'
import { Header } from '../ui/Header'
import { MessageSkeleton } from '../components/message/MessageSkeleton'
import { useClient } from '../contexts/Client'
import { PostView } from './Post'

interface Props {
    note: ApObject
}

export const ApNote = (props: Props) => {
    const { client } = useClient()

    // このnoteがローカルのAPブリッジ経由でconcrntメッセージとして保存されていれば、
    // そのURIを使ってネイティブ投稿と同じ詳細ビュー(リプライ/リアクション一覧付き)を出す。
    // undefined=照会中 / null=ブリッジ未保存(素のnote表示にフォールバック)
    const [messageUri, setMessageUri] = useState<string | null | undefined>(undefined)

    // 別のnoteに移った時は照会中表示に戻す(effect内setStateはeslint errorなので描画中に比較する)
    const [prevNoteId, setPrevNoteId] = useState(props.note.id)
    if (prevNoteId !== props.note.id) {
        setPrevNoteId(props.note.id)
        setMessageUri(undefined)
    }

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const info = await client.api.callConcrntApi<{ serviceAccountId: string }>(
                client.server.domain,
                'net.concrnt.activitypub.info',
                {}
            )
            const uri = apNoteKey(info.serviceAccountId, props.note.id)
            const message = await client.getMessage(uri)
            if (!cancelled) setMessageUri(message ? uri : null)
        })().catch(() => {
            if (!cancelled) setMessageUri(null)
        })
        return () => {
            cancelled = true
        }
    }, [client, props.note.id])

    if (!props.note.attributedTo) {
        return (
            <View>
                <Header>ActivityPub Note</Header>
                <div
                    style={{
                        padding: CssVar.space(2)
                    }}
                >
                    <p>Invalid note: attributedTo is missing</p>
                </div>
            </View>
        )
    }

    if (messageUri === undefined) {
        return (
            <View>
                <Header>ActivityPub Note</Header>
                <div
                    style={{
                        padding: CssVar.space(2)
                    }}
                >
                    <MessageSkeleton />
                </div>
            </View>
        )
    }

    if (messageUri) {
        return <PostView uri={messageUri} />
    }

    return (
        <View>
            <Header>ActivityPub Note</Header>
            <div
                style={{
                    padding: CssVar.space(2)
                }}
            >
                <Suspense fallback={<MessageSkeleton />}>
                    <ActivitypubNote noteURL={props.note.id} actorURL={props.note.attributedTo} forceExpanded detail />
                </Suspense>
            </div>
        </View>
    )
}
