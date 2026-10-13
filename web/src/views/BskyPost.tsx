import { CssVar } from '@concrnt/ui'
import { BlueskyRecord } from '../components/message/BlueskyRecord'
import { Suspense } from 'react'
import { MessageSkeleton } from '../components/message/MessageSkeleton'
import { View } from '../components/View'
import { Header } from '../components/Header'

interface Props {
    uri: string
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
                    <BlueskyRecord atUri={props.uri} detail />
                </Suspense>
            </div>
        </View>
    )
}
