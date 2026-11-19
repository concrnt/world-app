import { Button, CssVar, Divider, Tab, Tabs, Text } from '@concrnt/ui'
import { BlueskyRecord } from '../components/message/BlueskyRecord'
import { Suspense, useEffect, useState } from 'react'
import { MessageSkeleton } from '../components/message/MessageSkeleton'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { useClient } from '../contexts/Client'
import { PostView } from './Post'
import { useTranslation } from 'react-i18next'
import { MdAddReaction, MdMoreHoriz, MdRepeat, MdReply, MdStarOutline } from 'react-icons/md'
import { BskyPostView, bskyRecordKey, getBskyBridgeInfo } from '../utils/bluesky'

interface Props {
    uri: string
    // BskyViewでブリッジのresolveが返したpost view。ブリッジが輸出したconcrnt投稿ならconcrntURIが入る
    post?: BskyPostView
}

export const BskyPost = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.bskyPost' })
    const { client } = useClient()

    // この投稿がローカルのBlueskyブリッジ経由でconcrntメッセージとして保存されていれば、
    // そのURIを使ってネイティブ投稿と同じ詳細ビュー(リプライ/リアクション一覧付き)を出す(ApNoteと同型)。
    // undefined=照会中 / null=ブリッジ未保存(disabled表示+取得ボタンにフォールバック)
    const [messageUri, setMessageUri] = useState<string | null | undefined>(undefined)
    const [importError, setImportError] = useState<string | null>(null)

    // 別の投稿に移った時は照会中表示に戻す(effect内setStateはeslint errorなので描画中に比較する)
    const [prevUri, setPrevUri] = useState(props.uri)
    if (prevUri !== props.uri) {
        setPrevUri(props.uri)
        setMessageUri(undefined)
        setImportError(null)
    }

    // ブリッジが輸出した投稿は本体のconcrnt投稿そのものなので、ミラーの有無を照会せずにそちらを出す
    const nativeUri = props.post?.concrntURI

    useEffect(() => {
        if (nativeUri) return
        let cancelled = false
        ;(async () => {
            const info = await getBskyBridgeInfo(client)
            const uri = bskyRecordKey(info.serviceCcid, props.uri)
            const message = await client.getMessage(uri)
            if (!cancelled) setMessageUri(message ? uri : null)
        })().catch(() => {
            if (!cancelled) setMessageUri(null)
        })
        return () => {
            cancelled = true
        }
    }, [client, props.uri, nativeUri])

    if (nativeUri) {
        return <PostView uri={nativeUri} />
    }

    if (messageUri === undefined) {
        return (
            <View>
                <Header>Bluesky Post</Header>
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
    const canImport = 'world.concrnt.atproto.import' in (client.server?.endpoints ?? {})

    return (
        <View>
            <Header>Bluesky Post</Header>
            <div
                style={{
                    padding: CssVar.space(1)
                }}
            >
                <Suspense fallback={<MessageSkeleton />}>
                    <BlueskyRecord atUri={props.uri} post={props.post} detail />
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
                        groupId="bsky-post-detail-tabs-disabled"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Replies
                    </Tab>
                    <Tab
                        selected={false}
                        onClick={() => {}}
                        groupId="bsky-post-detail-tabs-disabled"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Reroutes
                    </Tab>
                    <Tab
                        selected={false}
                        onClick={() => {}}
                        groupId="bsky-post-detail-tabs-disabled"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Favorites
                    </Tab>
                    <Tab
                        selected={false}
                        onClick={() => {}}
                        groupId="bsky-post-detail-tabs-disabled"
                        style={{ color: CssVar.contentText, flex: 1 }}
                    >
                        Reactions
                    </Tab>
                </Tabs>
            </div>
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
                                    'world.concrnt.atproto.import',
                                    {},
                                    {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ uri: props.uri })
                                    }
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
                                console.error('failed to import bluesky post:', e)
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
