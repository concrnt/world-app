import { Suspense, use, useMemo } from 'react'
import { ApObject, resolveApObject } from '../../utils/activitypub'
import { Avatar, CfmRenderer, Skeleton, Text, type EmojiLite } from '@concrnt/ui'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/Client'
import { ApNoteSchema, Message } from '@concrnt/worldlib'
import { useTranslation } from 'react-i18next'
import { OnelineMessageLayout } from './OnelineLayout'
import { Timestamp } from './Timestamp'

interface Props {
    noteURL: string
    actorURL?: string
    // concrnt側のレコード(ap/note)があれば渡す。無い場合(リモートnoteのinReplyTo先など)は
    // ノート自身のpublishedを時刻に使い、遷移先はApViewになる
    message?: Message<ApNoteSchema>
}

// リプライ元などの1行表示用。ActivitypubNoteと同じ解決経路でノートを引き、本文はプレーンテキスト化して流す
export const ActivitypubNoteOneline = (props: Props) => {
    const { client } = useClient()
    const noteURL = props.noteURL
    const actorURL = props.actorURL

    const notePromise = useMemo(() => {
        return resolveApObject(client, noteURL).catch((e) => (e instanceof Error ? e : new Error(String(e))))
    }, [client, noteURL])

    const authorPromise = useMemo(() => {
        if (actorURL) return resolveApObject(client, actorURL).catch(() => null)
        return notePromise.then((n) =>
            n && !(n instanceof Error) && n.attributedTo
                ? resolveApObject(client, n.attributedTo).catch(() => null)
                : null
        )
    }, [client, actorURL, notePromise])

    return (
        <Suspense
            fallback={
                <OnelineMessageLayout left={<Skeleton style={{ width: '48px', height: '18px' }} />}>
                    <Skeleton style={{ flex: 1, height: '1em' }} />
                </OnelineMessageLayout>
            }
        >
            <Note notePromise={notePromise} authorPromise={authorPromise} noteURL={noteURL} message={props.message} />
        </Suspense>
    )
}

const Note = (props: {
    notePromise: Promise<ApObject | Error | null>
    authorPromise: Promise<ApObject | null>
    noteURL: string
    message?: Message<ApNoteSchema>
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.activitypubNote' })
    const navigate = useNavigate()

    const note = use(props.notePromise)
    const author = use(props.authorPromise)

    const emojiDict: Record<string, EmojiLite> = {}
    if (note && !(note instanceof Error)) {
        for (const tag of note.getTags()) {
            if (tag.type !== 'Emoji' || !tag.name) continue
            const icon = Array.isArray(tag.icon) ? tag.icon[0] : tag.icon
            if (icon?.url) emojiDict[tag.name.replace(/:/g, '')] = { imageURL: icon.url }
        }
    }

    const date =
        props.message?.createdAt ??
        (note && !(note instanceof Error) && note.published ? new Date(note.published) : null)

    return (
        <OnelineMessageLayout
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        if (note && !(note instanceof Error) && note.attributedTo) {
                            navigate('/activitypub/view/' + encodeURIComponent(note.attributedTo))
                        }
                    }}
                >
                    <Avatar
                        ccid={(note && !(note instanceof Error) && note.attributedTo) || ''}
                        src={author?.getIcons()[0]?.url}
                        style={{ width: '48px', height: '18px' }}
                    />
                </div>
            }
        >
            {!note || note instanceof Error ? (
                <Text style={{ opacity: 0.7 }}>{t('unavailable')}</Text>
            ) : (
                <CfmRenderer oneline messagebody={note.getPlainText()} emojiDict={emojiDict} />
            )}
            <div style={{ flex: 1 }} />
            {date && (
                <Timestamp
                    onClick={() => {
                        // concrnt側のメッセージがあればネイティブ同等の詳細ビューへ。無ければnote IDでApViewへ
                        // (ApView側でブリッジ保存済みなら自動でPostViewに切り替わる)
                        if (props.message) {
                            navigate('/post/' + encodeURIComponent(props.message.uri))
                        } else {
                            navigate('/activitypub/view/' + encodeURIComponent(props.noteURL))
                        }
                    }}
                >
                    <TimeDiff date={date} />
                </Timestamp>
            )}
        </OnelineMessageLayout>
    )
}
