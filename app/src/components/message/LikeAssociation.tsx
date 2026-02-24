import { MessageProps } from './types'
import { LikeAssociationSchema } from '@concrnt/worldlib'
import { Text } from '@concrnt/ui'

export const LikeAssociation = (props: MessageProps<LikeAssociationSchema>) => {
    return (
        <>
            <Text>
                {props.message.authorUser?.profile?.username} favorites{' '}
                {props.message.associationTarget?.authorUser?.profile?.username}&apos;s Post
            </Text>
            <blockquote>{props.message.associationTarget?.value.body}</blockquote>
        </>
    )
}
