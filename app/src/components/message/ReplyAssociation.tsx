import { MessageProps } from './types'
import { ReplyAssociationSchema } from '@concrnt/worldlib'
import { MessageContainer } from './main'

export const ReplyAssociation = (props: MessageProps<ReplyAssociationSchema>) => {
    // リプライメッセージをタイムラインと同一の表示で描画する
    return <MessageContainer uri={props.message.value.targetURI} />
}
