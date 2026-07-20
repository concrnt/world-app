import { CssVar, View } from '@concrnt/ui'
import { BskyPostView } from '../utils/bluesky'
import { BlueskyRecord } from '../components/message/BlueskyRecord'
import { Header } from '../ui/Header'
import { Suspense } from 'react'
import { MessageSkeleton } from '../components/message/MessageSkeleton'

interface Props {
    post: BskyPostView
}

export const BskyPost = (props: Props) => {
    return (
        <View>
            <Header>Bluesky Post</Header>
            <div
                style={{
                    padding: CssVar.space(2)
                }}
            >
                <Suspense fallback={<MessageSkeleton />}>
                    <BlueskyRecord atUri={props.post.uri} />
                </Suspense>
            </div>
        </View>
    )
}
