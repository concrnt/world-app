import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { ReplyMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, Text, IconButton } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'
import { MessageActions } from './MessageActions'
import { hapticSuccess } from '../../utils/haptics'
import { MessageLayout } from './MessageLayout'
import { MessageContainer } from './main'

export const ReplyMessage = (props: MessageProps<ReplyMessageSchema>) => {
    const { push } = useStack()
    const { client } = useClient()
    const { select } = useSelect()

    return (
        <>
            <MessageContainer uri={props.message.value.replyToMessageId} />
            <MessageLayout
                onClick={() => {
                    push(<PostView uri={props.message.uri} />)
                }}
                left={
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            push(<ProfileView id={props.message.author} />)
                        }}
                    >
                        <Avatar ccid={props.message.author} src={props.message.authorUser?.profile.avatar} />
                    </div>
                }
                headerLeft={
                    <div
                        style={{
                            fontWeight: 'bold'
                        }}
                    >
                        {props.message.authorUser?.profile.username || 'Anonymous'}
                    </div>
                }
                headerRight={
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            select(
                                '',
                                {
                                    delete: <Text>投稿を削除</Text>
                                },
                                (key) => {
                                    if (key === 'delete') {
                                        client?.api.delete(props.message.uri).then(() => hapticSuccess())
                                    }
                                }
                            )
                        }}
                        style={{
                            padding: 0,
                            margin: 0
                        }}
                    >
                        <MdMoreHoriz size={15} />
                    </IconButton>
                }
            >
                <CfmRenderer messagebody={props.message.value.body} emojiDict={{}} />
                <MessageActions message={props.message} />
            </MessageLayout>
        </>
    )
}
