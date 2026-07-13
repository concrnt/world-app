import { useTranslation } from 'react-i18next'
import { useClient } from '../../contexts/Client'
import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer, Text, IconButton, ListItem, useAnchor } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'
import { hapticSuccess } from '../../utils/haptics'
import { OnelineMessageLayout } from './OnelineLayout'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'

export const OnelineMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.onelineMessage' })
    const navigate = useNavigate()
    const { client } = useClient()
    const { select, close } = useSelect()
    const menuAnchor = useAnchor()

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
                    <Avatar
                        ccid={message.author}
                        src={message.authorUser?.profile.avatar}
                        style={{ width: '40px', height: '18px' }}
                    />
                </div>
            }
            onClick={() => {
                navigate('/post/' + encodeURIComponent(message.uri))
            }}
        >
            <CfmRenderer oneline messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
            <div style={{ flex: 1 }} />
            <IconButton
                onClick={(e) => {
                    e.stopPropagation()
                    select(
                        '',
                        [
                            <ListItem
                                key="delete"
                                onClick={() => {
                                    client.api.delete(message.uri).then(() => hapticSuccess())
                                    close()
                                }}
                            >
                                <Text>{t('deletePost')}</Text>
                            </ListItem>
                        ],
                        menuAnchor
                    )
                }}
                style={
                    {
                        padding: 0,
                        margin: 0,
                        anchorName: menuAnchor
                    } as React.CSSProperties
                }
            >
                <MdMoreHoriz size={15} />
            </IconButton>
            <div style={{ flexShrink: 0 }}>
                <TimeDiff date={props.message.createdAt} />
            </div>
        </OnelineMessageLayout>
    )
}
