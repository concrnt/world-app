import { Suspense, use, useMemo } from 'react'
import { ApObject, resolveApObject } from '../../utils/activitypub'
import { Avatar, CssVar, GfmRenderer, MfmRenderer, Text, type EmojiLite } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/Client'
import { MessageSkeleton } from './MessageSkeleton'
import { MessageLayout } from './MessageLayout'
import { SiActivitypub } from 'react-icons/si'
import { useTranslation } from 'react-i18next'

interface Props {
    noteURL: string
    actorURL?: string
    onClick?: () => void
}

// Like/Reaction/RerouteAssociationの「対象投稿」カード(アバター+作者名+本文のみ、時刻やフッター無し)のAPノート版。
// ネイティブ対象のMessageLayoutカードと同じ見た目に揃え、作者名にはActivitypubNoteと同じAPバッジ+ハンドルを出す
export const ActivitypubNoteCard = (props: Props) => {
    const { client } = useClient()

    const notePromise = useMemo(() => {
        return resolveApObject(client, props.noteURL).catch((e) => (e instanceof Error ? e : new Error(String(e))))
    }, [client, props.noteURL])

    const authorPromise = useMemo(() => {
        if (props.actorURL) return resolveApObject(client, props.actorURL).catch(() => null)
        return notePromise.then((n) =>
            n && !(n instanceof Error) && n.attributedTo
                ? resolveApObject(client, n.attributedTo).catch(() => null)
                : null
        )
    }, [client, props.actorURL, notePromise])

    return (
        <Suspense fallback={<MessageSkeleton />}>
            <Card notePromise={notePromise} authorPromise={authorPromise} onClick={props.onClick} />
        </Suspense>
    )
}

const Card = (props: {
    notePromise: Promise<ApObject | Error | null>
    authorPromise: Promise<ApObject | null>
    onClick?: () => void
}) => {
    const { t } = useTranslation('', { keyPrefix: 'components.activitypubNote' })
    const navigate = useNavigate()

    const note = use(props.notePromise)
    const author = use(props.authorPromise)

    if (!note || note instanceof Error) {
        return (
            <div style={{ padding: CssVar.space(1), paddingLeft: '56px' }}>
                <Text style={{ opacity: 0.7, fontSize: '0.8rem' }}>{t('unavailable')}</Text>
            </div>
        )
    }

    const emojiDict: Record<string, EmojiLite> = {}
    for (const tag of note.getTags()) {
        if (tag.type !== 'Emoji' || !tag.name) continue
        const icon = Array.isArray(tag.icon) ? tag.icon[0] : tag.icon
        if (icon?.url) emojiDict[tag.name.replace(/:/g, '')] = { imageURL: icon.url }
    }

    return (
        <MessageLayout
            onClick={props.onClick}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        if (note.attributedTo) navigate('/activitypub/view/' + encodeURIComponent(note.attributedTo))
                    }}
                >
                    <Avatar ccid={note.attributedTo ?? ''} src={author?.getIcons()[0]?.url} />
                </div>
            }
            headerLeft={
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(1),
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <Text
                        style={{
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {author?.name ?? author?.preferredUsername ?? 'Unknown'}
                    </Text>
                    <SiActivitypub size={14} style={{ flexShrink: 0 }} title="ActivityPub" />
                    {author?.getHandle() && (
                        <span
                            style={{
                                fontSize: '0.75rem',
                                opacity: 0.7,
                                flexShrink: 1000,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {author.getHandle()}
                        </span>
                    )}
                </span>
            }
        >
            {note._misskey_content ? (
                <MfmRenderer messagebody={note._misskey_content} emojiDict={emojiDict} />
            ) : (
                <GfmRenderer messagebody={note.content ?? ''} emojiDict={emojiDict} />
            )}
        </MessageLayout>
    )
}
