import { CssVar, View } from '@concrnt/ui'
import { ApObject } from '../utils/activitypub'
import { ActivitypubNote } from '../components/message/ActivitypubNote'
import { Suspense } from 'react'
import { Header } from '../ui/Header'
import { MessageSkeleton } from '../components/message/MessageSkeleton'

interface Props {
    note: ApObject
}

export const ApNote = (props: Props) => {
    return (
        <View>
            <Header>ActivityPub Note</Header>
            <div
                style={{
                    padding: CssVar.space(2)
                }}
            >
                <Suspense fallback={<MessageSkeleton />}>
                    <ActivitypubNote notePromise={Promise.resolve(props.note)} />
                </Suspense>
            </div>
        </View>
    )
}
