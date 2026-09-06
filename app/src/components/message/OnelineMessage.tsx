import { useTranslation } from 'react-i18next'
import { useClient } from '../../contexts/Client'
import { useStack } from '../../layouts/Stack'
import { MessageProps } from './types'
import { MarkdownMessageSchema } from '@concrnt/worldlib'

import { ProfileView } from '../../views/Profile'
import { PostView } from '../../views/Post'

import { Avatar, CfmRenderer, Confirm, Text, IconButton, ListItem, Select } from '@concrnt/ui'

import { useState } from 'react'
import { MdMoreHoriz } from 'react-icons/md'
import { useHaptics } from '../../contexts/Haptics'
import { OnelineMessageLayout } from './OnelineLayout'
import { TimeDiff } from '../TimeDiff'

export const OnelineMessage = (props: MessageProps<MarkdownMessageSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.onelineMessage' })
    const { push } = useStack()
    const { client } = useClient()
    const { hapticSuccess } = useHaptics()

    const [menuOpen, setMenuOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

    const message = props.message

    return (
        <OnelineMessageLayout
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        push(<ProfileView ccid={message.author} profileName={message.authorProfileName ?? undefined} />)
                    }}
                >
                    <Avatar
                        ccid={message.author}
                        src={message.authorProfile?.avatar}
                        style={{ width: '40px', height: '18px' }}
                    />
                </div>
            }
            onClick={() => {
                push(<PostView uri={message.uri} />)
            }}
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
                        style={{
                            padding: 0,
                            margin: 0,
                            width: '15px',
                            height: '15px'
                        }}
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
                                    setMenuOpen(false)
                                    setDeleteConfirmOpen(true)
                                }}
                            >
                                <Text>{t('deletePost')}</Text>
                            </ListItem>
                        ]}
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
            <div style={{ flexShrink: 0 }}>
                <TimeDiff date={props.message.createdAt} />
            </div>
        </OnelineMessageLayout>
    )
}
