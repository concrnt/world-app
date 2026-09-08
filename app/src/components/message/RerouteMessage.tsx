import { useTranslation } from 'react-i18next'
import { useClient } from '../../contexts/Client'
import { MessageProps } from './types'
import { RerouteMessageSchema } from '@concrnt/worldlib'

import { Avatar, Text, IconButton, ListItem, Select } from '@concrnt/ui'

import { useState } from 'react'
import { MdMoreHoriz } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { useHaptics } from '../../contexts/Haptics'
import { OnelineMessageLayout } from './OnelineLayout'
import { MessageContainer } from './main'
import { TimeDiff } from '../TimeDiff'
import { RenderError } from './RenderError'
import { ErrorBoundary } from 'react-error-boundary'
import { useStack } from '../../layouts/Stack'
import { ProfileView } from '../../views/Profile'

export const RerouteMessage = (props: MessageProps<RerouteMessageSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.rerouteMessage' })
    const { client } = useClient()
    const { push } = useStack()
    const { hapticSuccess } = useHaptics()

    const [menuOpen, setMenuOpen] = useState(false)

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
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                push(
                                    <ProfileView
                                        ccid={props.message.author}
                                        profileName={props.message.authorProfileName ?? undefined}
                                    />
                                )
                            }}
                            style={{ display: 'flex', cursor: 'pointer' }}
                        >
                            <Avatar
                                ccid={props.message.author}
                                src={props.message.authorProfile?.avatar}
                                style={{ width: '16px', height: '16px' }}
                            />
                        </div>
                    </div>
                }
            >
                <span
                    onClick={(e) => {
                        e.stopPropagation()
                        push(
                            <ProfileView
                                ccid={props.message.author}
                                profileName={props.message.authorProfileName ?? undefined}
                            />
                        )
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <Text variant="caption">
                        {t('userRerouted', { name: props.message.authorProfile?.username || 'Anonymous' })}
                    </Text>
                </span>
                <div style={{ flex: 1 }} />
                {props.message.author === client.ccid && (
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
                                        client.api.delete(props.message.uri).then(() => hapticSuccess())
                                    }}
                                >
                                    <Text>{t('deleteReroute')}</Text>
                                </ListItem>
                            ]}
                        />
                    </>
                )}
                <div style={{ flexShrink: 0 }}>
                    <TimeDiff date={props.message.createdAt} />
                </div>
            </OnelineMessageLayout>
            <ErrorBoundary FallbackComponent={RenderError}>
                {/* rerouteした本人は元投稿が見えているはずなので、そのホームドメインを解決hintに使う */}
                <MessageContainer
                    uri={props.message.value.targetURI}
                    hint={props.message.authorUser?.domain ?? props.message.hint}
                    rerouted={props.message}
                />
            </ErrorBoundary>
        </div>
    )
}
