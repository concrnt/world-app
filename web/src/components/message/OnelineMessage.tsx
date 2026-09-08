import { useTranslation } from 'react-i18next'
import { useClient } from '../../contexts/Client'
import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer, Confirm, Text, IconButton, ListItem, useAnchor } from '@concrnt/ui'

import { useState } from 'react'
import { MdMoreHoriz } from 'react-icons/md'
import { Select } from '../Select'
import { useHaptics } from '../../contexts/Haptics'
import { OnelineMessageLayout } from './OnelineLayout'
import { Timestamp } from './Timestamp'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'

export const OnelineMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.onelineMessage' })
    const navigate = useNavigate()
    const { client } = useClient()
    const { hapticSuccess } = useHaptics()
    const menuAnchor = useAnchor()

    const [menuOpen, setMenuOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

    const message = props.message

    return (
        <OnelineMessageLayout
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        navigate(
                            '/profile/' +
                                message.author +
                                (message.authorProfileName && message.authorProfileName !== 'main'
                                    ? '/' + message.authorProfileName
                                    : '')
                        )
                    }}
                >
                    <Avatar
                        ccid={message.author}
                        src={message.authorProfile?.avatar}
                        style={{ width: '48px', height: '18px' }}
                    />
                </div>
            }
        >
            <CfmRenderer oneline messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
            <div style={{ flex: 1 }} />
            {message.author === client.ccid && (
                <>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpen(true)
                        }}
                        style={
                            {
                                padding: 0,
                                margin: 0,
                                anchorName: menuAnchor,
                                width: '15px',
                                height: '15px'
                            } as React.CSSProperties
                        }
                    >
                        <MdMoreHoriz size={15} />
                    </IconButton>
                    <Select
                        open={menuOpen}
                        onClose={() => setMenuOpen(false)}
                        options={[
                            <ListItem
                                key="delete"
                                onClick={() => {
                                    setDeleteConfirmOpen(true)
                                    setMenuOpen(false)
                                }}
                            >
                                <Text>{t('deletePost')}</Text>
                            </ListItem>
                        ]}
                        anchor={menuAnchor}
                    />
                    <Confirm
                        open={deleteConfirmOpen}
                        onClose={() => setDeleteConfirmOpen(false)}
                        title={t('components.messageActions.confirmDelete', { keyPrefix: '' })}
                        confirmText={t('components.messageActions.delete', { keyPrefix: '' })}
                        onConfirm={() => {
                            client.api.delete(message.uri).then(() => hapticSuccess())
                        }}
                    />
                </>
            )}
            <Timestamp
                onClick={() => {
                    navigate('/post/' + encodeURIComponent(message.uri))
                }}
            >
                <TimeDiff date={props.message.createdAt} />
            </Timestamp>
        </OnelineMessageLayout>
    )
}
