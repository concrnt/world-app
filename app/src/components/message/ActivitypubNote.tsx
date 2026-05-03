import { Suspense, use, useMemo } from 'react'
import { ApObject } from '../../utils/activitypub'
import { useStack } from '../../layouts/Stack'
import { MessageLayout } from './MessageLayout'
import { Avatar, CfmRenderer, CssVar, Text } from '@concrnt/ui'
import { TimeDiff } from '../TimeDiff'
import { ApView } from '../../views/ApView'
import { useClient } from '../../contexts/Client'
import { MessageSkeleton } from './MessageSkeleton'

interface Props {
    notePromise: Promise<ApObject>
}

export const ActivitypubNote = (props: Props) => {
    const { client } = useClient()
    const note = use(props.notePromise)

    const authorPromise = useMemo(() => {
        if (!note.attributedTo) return Promise.resolve(null)
        return client.api
            .fetchWithCredential<ApObject>(
                client.server.domain,
                `/ap/api/resolve?uri=${encodeURIComponent(note.attributedTo)}`
            )
            .then(async (res) => new ApObject(res))
    }, [note, client])

    return (
        <Suspense fallback={<MessageSkeleton />}>
            <Note note={note} authorPromise={authorPromise} />
        </Suspense>
    )
}

const Note = (props: { note: ApObject; authorPromise: Promise<ApObject | null> }) => {
    const { push } = useStack()

    const note = props.note
    const author = use(props.authorPromise)

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
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    justifyContent: 'space-between',
                    alignItems: 'stretch',
                    flexWrap: 'wrap',
                    gap: CssVar.space(1)
                }}
            ></div>
        </MessageLayout>
    )
}
