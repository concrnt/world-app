import { Suspense, use, useMemo } from 'react'
import { ApObject, resolveApObject } from '../../utils/activitypub'
import { useStack } from '../../layouts/Stack'
import { MessageLayout } from './MessageLayout'
import { Avatar, CssVar, GfmRenderer, MfmRenderer, Text, type EmojiLite } from '@concrnt/ui'
import { TimeDiff } from '../TimeDiff'
import { ApView } from '../../views/ApView'
import { useClient } from '../../contexts/Client'
import { MessageSkeleton } from './MessageSkeleton'
import { ApNoteSchema, Message } from '@concrnt/worldlib'
import { MessageFooter } from './Footer'
import { CollapsibleBody } from './CollapsibleBody'
import { usePreference } from '../../contexts/Preference'

interface Props {
    actorURL: string
    noteURL: string
    message?: Message<ApNoteSchema>
    forceExpanded?: boolean
}

export const ActivitypubNote = (props: Props) => {
    const { client } = useClient()

    const notePromise = useMemo(() => {
        return resolveApObject(client, props.noteURL).catch((e) => (e instanceof Error ? e : new Error(String(e))))
    }, [client, props.noteURL])

    const authorPromise = useMemo(() => {
        return resolveApObject(client, props.actorURL).catch(() => null)
    }, [client, props.actorURL])

    return (
        <Suspense fallback={<MessageSkeleton />}>
            <Note
                notePromise={notePromise}
                authorPromise={authorPromise}
                noteURL={props.noteURL}
                message={props.message}
                forceExpanded={props.forceExpanded}
            />
        </Suspense>
    )
}

const Note = (props: {
    notePromise: Promise<ApObject | Error | null>
    authorPromise: Promise<ApObject | null>
    noteURL: string
    message?: Message<ApNoteSchema>
    forceExpanded?: boolean
}) => {
    const { push } = useStack()
    const [devmode] = usePreference('developerMode')

    const note = use(props.notePromise)
    const author = use(props.authorPromise)

    if (!note || note instanceof Error) {
        return (
            <div
                style={{
                    padding: CssVar.space(2)
                }}
            >
                <Text>Note not found</Text>
                {devmode && <Text variant="caption">{props.noteURL}</Text>}
                {devmode && (
                    <Text variant="caption">{note instanceof Error ? note.message : 'negative cache hit'}</Text>
                )}
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
            onClick={() => {
                push(<ApView uri={note.id} />)
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        if (note.attributedTo) push(<ApView uri={note.attributedTo} />)
                    }}
                >
                    <Avatar ccid={note.attributedTo ?? ''} src={author?.getIcons()[0]?.url} />
                </div>
            }
            headerLeft={
                <Text
                    style={{
                        fontWeight: 'bold'
                    }}
                >
                    {author?.name ?? author?.preferredUsername ?? 'Unknown'}
                </Text>
            }
            headerRight={note.published && <TimeDiff date={new Date(note.published)} />}
        >
            <CollapsibleBody forceExpanded={props.forceExpanded}>
                {note._misskey_content ? (
                    <MfmRenderer messagebody={note._misskey_content} emojiDict={emojiDict} />
                ) : (
                    <GfmRenderer messagebody={note.content ?? ''} />
                )}
            </CollapsibleBody>
            {devmode && <Text variant="caption">{props.noteURL}</Text>}
            {props.message && <MessageFooter message={props.message} />}
        </MessageLayout>
    )
}
