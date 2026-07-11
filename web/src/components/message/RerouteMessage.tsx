import { useClient } from '../../contexts/Client'
import { MessageProps } from './types'
import { RerouteMessageSchema } from '@concrnt/worldlib'

import { Avatar, Text, IconButton, ListItem, useAnchor } from '@concrnt/ui'

import { MdMoreHoriz } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { useSelect } from '../../contexts/Select'
import { hapticSuccess } from '../../utils/haptics'
import { OnelineMessageLayout } from './OnelineLayout'
import { MessageContainer } from './main'
import { TimeDiff } from '../TimeDiff'

export const RerouteMessage = (props: MessageProps<RerouteMessageSchema>) => {
    const { client } = useClient()
    const { select, close } = useSelect()
    const menuAnchor = useAnchor()

    return (
        <div>
            <OnelineMessageLayout
                left={
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            opacity: 0.7
                        }}
                    >
                        <MdRepeat size={14} />
                        <Avatar
                            ccid={props.message.author}
                            src={props.message.authorUser?.profile.avatar}
                            style={{ width: '16px', height: '16px' }}
                        />
                    </div>
                }
            >
                <Text variant="caption">
                    {props.message.authorUser?.profile.username || 'Anonymous'}さんがリルートしました
                </Text>
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
                                        client.api.delete(props.message.uri).then(() => hapticSuccess())
                                        close()
                                    }}
                                >
                                    <Text>リルートを削除</Text>
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
                <TimeDiff date={props.message.createdAt} />
            </OnelineMessageLayout>
            <MessageContainer uri={props.message.value.targetURI} />
        </div>
    )
}
