import { MessageProps } from './types'
import { LikeAssociationSchema } from '@concrnt/worldlib'
import { Text } from '../../ui/Text'

export const LikeAssociation = (props: MessageProps<LikeAssociationSchema>) => {
    return (
        <>
            <Text>{props.message.authorUser?.profile?.username} liked </Text>
        </>
    )
}
