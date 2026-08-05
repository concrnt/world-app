import { Button, CssVar, Divider, Tab, Tabs, Text } from '@concrnt/ui'
import { ApObject, apNoteKey } from '../utils/activitypub'
import { ActivitypubNote } from '../components/message/ActivitypubNote'
import { Suspense, useEffect, useState } from 'react'
import { MessageSkeleton } from '../components/message/MessageSkeleton'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { useClient } from '../contexts/Client'
import { PostView } from './Post'
import { useTranslation } from 'react-i18next'
import { MdAddReaction, MdMoreHoriz, MdRepeat, MdReply, MdStarOutline } from 'react-icons/md'

interface Props {
    note: ApObject
}

export const ApNote = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.apNote' })
    const { client } = useClient()

    // このnoteがローカルのAPブリッジ経由でconcrntメッセージとして保存されていれば、
    // そのURIを使ってネイティブ投稿と同じ詳細ビュー(リプライ/リアクション一覧付き)を出す。
    // undefined=照会中 / null=ブリッジ未保存(disabled表示+取得ボタンにフォールバック)
    const [messageUri, setMessageUri] = useState<string | null | undefined>(undefined)
    const [importError, setImportError] = useState<string | null>(null)

    // 別のnoteに移った時は照会中表示に戻す(effect内setStateはeslint errorなので描画中に比較する)
    const [prevNoteId, setPrevNoteId] = useState(props.note.id)
    if (prevNoteId !== props.note.id) {
        setPrevNoteId(props.note.id)
        setMessageUri(undefined)
        setImportError(null)
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

    // ブリッジ未保存: 詳細ビューのガワ(アクション行+タブ行)をグレーアウトで見せつつ、
    // 「concrntメッセージとして取得する」でオンデマンド実体化できるようにする
    const canImport = 'net.concrnt.activitypub.import' in (client.server?.endpoints ?? {})

    return (
        <View>
            <Header>ActivityPub Note</Header>
            <div
                style={{
                    padding: CssVar.space(1)
                }}
            >
                <Suspense fallback={<MessageSkeleton />}>
                    <ActivitypubNote noteURL={props.note.id} actorURL={props.note.attributedTo} forceExpanded detail />
                </Suspense>
                <div
                    style={{
                        opacity: 0.45,
                        pointerEvents: 'none',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: CssVar.space(3),
                        // MessageLayoutのアバター列(40px)+gap(8px)ぶんを空けて実フッターと揃える
                        paddingLeft: '48px',
                        paddingTop: CssVar.space(1),
                        color: CssVar.contentText
                    }}
                >
                    <MdReply size={20} />
                    <MdRepeat size={20} />
                    <MdStarOutline size={20} />
                    <MdAddReaction size={20} />
                    <MdMoreHoriz size={20} />
                </div>
            </div>
            <Divider />
            <div
                style={{
                    opacity: 0.45,
                    pointerEvents: 'none'
                }}
            >
                <Tabs>
                    <Tab
                        selected
                        onClick={() => {}}
                        groupId="ap-note-detail-tabs-disabled"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Replies
                    </Tab>
                    <Tab
                        selected={false}
                        onClick={() => {}}
                        groupId="ap-note-detail-tabs-disabled"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Reroutes
                    </Tab>
                    <Tab
                        selected={false}
                        onClick={() => {}}
                        groupId="ap-note-detail-tabs-disabled"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Favorites
                    </Tab>
                    <Tab
                        selected={false}
                        onClick={() => {}}
                        groupId="ap-note-detail-tabs-disabled"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Reactions
                    </Tab>
                </Tabs>
            </div>
            <Divider />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: CssVar.space(1),
                    padding: CssVar.space(2)
                }}
            >
                <Text style={{ opacity: 0.7 }}>{t('notImported')}</Text>
                {importError && <Text style={{ color: '#ff5b5b' }}>{importError}</Text>}
                {canImport && (
                    <Button
                        busyChildren={t('importing')}
                        onClick={async () => {
                            setImportError(null)
                            try {
                                const res = await client.api.callConcrntApi<{ key: string }>(
                                    client.server.domain,
                                    'net.concrnt.activitypub.import',
                                    {},
                                    { method: 'POST', body: JSON.stringify({ uri: props.note.id }) }
                                )
                                // 直前の存在チェックがKVSに負キャッシュ(404の記憶)を残しているため、
                                // no-cacheで正エントリを取り直す(commit伝播待ちで1回だけリトライ)
                                try {
                                    await client.api.getDocument(res.key, undefined, { cache: 'no-cache' })
                                } catch {
                                    await new Promise((resolve) => setTimeout(resolve, 500))
                                    await client.api.getDocument(res.key, undefined, { cache: 'no-cache' })
                                }
                                // worldlib側のnullキャッシュも消してからPostViewへ切り替える
                                client.invalidateMessage(res.key)
                                setMessageUri(res.key)
                            } catch (e) {
                                console.error('failed to import ap note:', e)
                                setImportError(t('importFailed'))
                            }
                        }}
                    >
                        {t('import')}
                    </Button>
                )}
            </div>
        </View>
    )
}
