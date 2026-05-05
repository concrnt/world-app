import { Suspense, use, useMemo } from 'react'
import { ApObject } from '../../utils/activitypub'
import { useStack } from '../../layouts/Stack'
import { MessageLayout } from './MessageLayout'
import { Avatar, CfmRenderer, CssVar, Text } from '@concrnt/ui'
import { TimeDiff } from '../TimeDiff'
import { ApView } from '../../views/ApView'
import { useClient } from '../../contexts/Client'
import { MessageSkeleton } from './MessageSkeleton'
import { PostedTimelines } from './PostedTimelines'
import { MessageActions } from './MessageActions'
import { ApNoteSchema, Message } from '@concrnt/worldlib'

interface Props {
    actorURL: string
    noteURL: string
    message?: Message<ApNoteSchema>
}

export const ActivitypubNote = (props: Props) => {
    const { client } = useClient()

    const notePromise = useMemo(() => {
        return client.api
            .fetchWithCredential<ApObject>(
                client.server.domain,
                `/ap/api/resolve?uri=${encodeURIComponent(props.noteURL)}`
            )
            .then(async (res) => new ApObject(res))
    }, [client, props.noteURL])

    const authorPromise = useMemo(() => {
        return client.api
            .fetchWithCredential<ApObject>(
                client.server.domain,
                `/ap/api/resolve?uri=${encodeURIComponent(props.actorURL)}`
            )
            .then(async (res) => new ApObject(res))
    }, [client, props.actorURL])

    return (
        <Suspense fallback={<MessageSkeleton />}>
            <Note notePromise={notePromise} authorPromise={authorPromise} message={props.message} />
        </Suspense>
    )
}

const Note = (props: {
    notePromise: Promise<ApObject | null>
    authorPromise: Promise<ApObject | null>
    message?: Message<ApNoteSchema>
}) => {
    const { push } = useStack()

    const note = use(props.notePromise)
    const author = use(props.authorPromise)

    if (!note) {
        return (
            <div
                style={{
                    padding: CssVar.space(2)
                }}
            >
                <Text>Note not found</Text>
            </div>
        )
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
            <CfmRenderer messagebody={note.content ?? ''} emojiDict={{}} />
            {props.message && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row-reverse',
                        justifyContent: 'space-between',
                        alignItems: 'stretch',
                        flexWrap: 'wrap',
                        gap: CssVar.space(1)
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}
                    >
                        <PostedTimelines message={props.message} />
                    </div>
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start'
                        }}
                    >
                        <MessageActions message={props.message} />
                    </div>
                </div>
            )}
        </MessageLayout>
    )
}
