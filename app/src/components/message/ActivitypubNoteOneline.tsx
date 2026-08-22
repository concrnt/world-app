import { Suspense, use, useMemo } from 'react'
import { ApObject, resolveApObject } from '../../utils/activitypub'
import { Avatar, CfmRenderer, Skeleton, Text, type EmojiLite } from '@concrnt/ui'
import { TimeDiff } from '../TimeDiff'
import { useStack } from '../../layouts/Stack'
import { useClient } from '../../contexts/Client'
import { ApNoteSchema, Message } from '@concrnt/worldlib'
import { useTranslation } from 'react-i18next'
import { OnelineMessageLayout } from './OnelineLayout'
import { ApView } from '../../views/ApView'
import { PostView } from '../../views/Post'

interface Props {
    message: Message<ApNoteSchema>
}

// リプライ元などの1行表示用。ActivitypubNoteと同じ解決経路でノートを引き、本文はプレーンテキスト化して流す
export const ActivitypubNoteOneline = (props: Props) => {
    const { client } = useClient()
    const noteURL = props.message.value.noteURL
    const actorURL = props.message.value.actorURL

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
                <OnelineMessageLayout left={<Skeleton style={{ width: '40px', height: '18px' }} />}>
                    <Skeleton style={{ flex: 1, height: '1em' }} />
                </OnelineMessageLayout>
            }
        >
            <Note notePromise={notePromise} authorPromise={authorPromise} message={props.message} />
        </Suspense>
    )
}

const Note = (props: {
    notePromise: Promise<ApObject | Error | null>
    authorPromise: Promise<ApObject | null>
    message: Message<ApNoteSchema>
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.activitypubNote' })
    const { push } = useStack()

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

    return (
        <OnelineMessageLayout
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        if (note && !(note instanceof Error) && note.attributedTo) {
                            push(<ApView uri={note.attributedTo} />)
                        }
                    }}
                >
                    <Avatar
                        ccid={(note && !(note instanceof Error) && note.attributedTo) || ''}
                        src={author?.getIcons()[0]?.url}
                        style={{ width: '40px', height: '18px' }}
                    />
                </div>
            }
            onClick={() => {
                push(<PostView uri={props.message.uri} />)
            }}
        >
            {!note || note instanceof Error ? (
                <Text style={{ opacity: 0.7 }}>{t('unavailable')}</Text>
            ) : (
                <CfmRenderer oneline messagebody={note.getPlainText()} emojiDict={emojiDict} />
            )}
            <div style={{ flex: 1 }} />
            <div style={{ flexShrink: 0 }}>
                <TimeDiff date={props.message.createdAt} />
            </div>
        </OnelineMessageLayout>
    )
}
