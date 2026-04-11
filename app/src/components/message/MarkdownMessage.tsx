import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, Text, IconButton } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'
import { MessageActions } from './MessageActions'
import { hapticSuccess } from '../../utils/haptics'
import { MessageLayout } from './MessageLayout'

export const MarkdownMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const { push } = useStack()
    const { client } = useClient()
    const { select } = useSelect()

    const message = props.message

    return (
        <MessageLayout
            onClick={() => {
                push(<PostView uri={message.uri} />)
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<ProfileView id={message.author} />)
                    }}
                >
                    <Avatar ccid={message.author} src={message.authorUser?.profile.avatar} />
                </div>
            }
            headerLeft={
                <div
                    style={{
                        fontWeight: 'bold'
                    }}
                >
                    {message.authorUser?.profile.username}
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
                                    client?.api.delete(message.uri).then(() => hapticSuccess())
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
            <CfmRenderer messagebody={message.value.body} emojiDict={{}} />
            <MessageActions message={message} />
        </MessageLayout>
    )
}
