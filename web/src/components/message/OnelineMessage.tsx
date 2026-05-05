import { useClient } from '../../contexts/Client'
import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer, Text, IconButton, ListItem } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'
import { hapticSuccess } from '../../utils/haptics'
import { OnelineMessageLayout } from './OnelineLayout'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'

export const OnelineMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const navigate = useNavigate()
    const { client } = useClient()
    const { select } = useSelect()

    const message = props.message

    return (
        <OnelineMessageLayout
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        navigate('/profile/' + message.author)
                    }}
                >
                    <Avatar ccid={message.author} src={message.authorUser?.profile.avatar} />
                </div>
            }
            onClick={() => {
                navigate('/post/' + encodeURIComponent(message.uri))
            }}
        >
            <CfmRenderer messagebody={message.value.body} emojiDict={{}} />
            <div style={{ flex: 1 }} />
            <IconButton
                onClick={(e) => {
                    e.stopPropagation()
                    select('', [
                        <ListItem
                            key="delete"
                            onClick={() => {
                                client.api.delete(message.uri).then(() => hapticSuccess())
                            }}
                        >
                            <Text>投稿を削除</Text>
                        </ListItem>
                    ])
                }}
                style={{
                    padding: 0,
                    margin: 0
                }}
            >
                <MdMoreHoriz size={15} />
            </IconButton>
            <TimeDiff date={props.message.createdAt} />
        </OnelineMessageLayout>
    )
}
