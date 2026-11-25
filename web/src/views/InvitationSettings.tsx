import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdMoreHoriz } from 'react-icons/md'
import { Button, Confirm, IconButton, ListItem, Text, TextField, useAnchor } from '@concrnt/ui'
import { Document, SignedDocument } from '@concrnt/client'
import { InvitationSchema, Schemas, semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { TimelinePicker } from '../components/TimelinePicker'
import { Select } from '../components/Select'
import { Header } from '../components/Header'
import { View } from '../components/View'
import { CssVar } from '../types/Theme'

export const InvitationSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.invitationSettings' })

    return (
        <View>
            <Header>{t('title')}</Header>
            <InvitationForm />
        </View>
    )
}

const InvitationForm = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.invitationSettings' })
    const { client } = useClient()
    const [comment, setComment] = useState('Welcome!')
    const [timelines, setTimelines] = useState<string[]>([])
    const [defaultPostTimelines, setDefaultPostTimelines] = useState<string[]>([])
    const [invitations, setInvitations] = useState<SignedDocument[]>([])
    const [menu, setMenu] = useState<string>()
    const [deleting, setDeleting] = useState<string>()
    const menuAnchor = useAnchor()

    const load = useCallback(
        () =>
            client.api
                .queryAll({ prefix: `cckv://${client.ccid}/concrnt.world/invitations/`, schema: Schemas.invitation })
                .then(setInvitations),
        [client]
    )

    useEffect(() => {
        load().catch((err) => console.error('Failed to load invitations', err))
    }, [load])

    return (
        <div
            style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(3),
                padding: CssVar.space(4)
            }}
        >
            <Text style={{ color: CssVar.contentTextDim }}>{t('description')}</Text>
            <Text variant="h3">{t('comment')}</Text>
            <TextField value={comment} onChange={(e) => setComment(e.target.value)} />
            <Text variant="h3">{t('timelines')}</Text>
            <Text variant="caption" style={{ color: CssVar.contentTextDim }}>
                {t('timelinesDescription')}
            </Text>
            <TimelinePicker selected={timelines} setSelected={setTimelines} addLabel={t('selectCommunity')} />
            <Text variant="h3">{t('defaultPostTimelines')}</Text>
            <Text variant="caption" style={{ color: CssVar.contentTextDim }}>
                {t('defaultPostTimelinesDescription')}
            </Text>
            <TimelinePicker
                selected={defaultPostTimelines}
                setSelected={setDefaultPostTimelines}
                addLabel={t('selectCommunity')}
            />
            <Button
                disabled={comment === '' || timelines.length === 0}
                busyChildren={t('creating')}
                onClick={async () => {
                    const document: Document<InvitationSchema> = {
                        kind: 'record',
                        key: semantics.invitation(client.ccid, Date.now().toString()),
                        author: client.ccid,
                        schema: Schemas.invitation,
                        value: {
                            comment,
                            timelines,
                            defaultPostTimelines
                        },
                        createdAt: new Date()
                    }
                    await client.api.commit(document)
                    setComment('Welcome!')
                    setTimelines([])
                    setDefaultPostTimelines([])
                    await load()
                }}
            >
                {t('create')}
            </Button>
            <Text variant="h3">{t('created')}</Text>
            {invitations.length === 0 && (
                <Text variant="caption" style={{ color: CssVar.contentTextDim }}>
                    {t('empty')}
                </Text>
            )}
            {invitations.map((sd) => {
                const document: Document<InvitationSchema> = JSON.parse(sd.document)
                return (
                    <div
                        key={sd.cckv}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(1),
                            padding: CssVar.space(2),
                            borderRadius: CssVar.round(1),
                            border: `1px solid ${CssVar.divider}`
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Text>{document.value.comment}</Text>
                            <Text variant="caption" style={{ color: CssVar.contentTextDim }}>
                                {new Date(document.createdAt).toLocaleString()}
                            </Text>
                        </div>
                        <IconButton
                            onClick={() => setMenu(sd.cckv)}
                            style={{ anchorName: menu === sd.cckv ? menuAnchor : undefined } as React.CSSProperties}
                        >
                            <MdMoreHoriz size={20} />
                        </IconButton>
                    </div>
                )
            })}
            <Select
                open={menu !== undefined}
                onClose={() => setMenu(undefined)}
                anchor={menuAnchor}
                options={[
                    <ListItem
                        key="copyLink"
                        onClick={() => {
                            // 受け手は未登録で、エントリポイントから招待者を解決できるとは限らないのでヒントを付ける
                            navigator.clipboard.writeText(
                                `https://concrnt.world/invitation/${client.ccid}/${menu!.split('/').pop()}?hint=${client.entity.domain}`
                            )
                            setMenu(undefined)
                        }}
                    >
                        <Text>{t('copyLink')}</Text>
                    </ListItem>,
                    <ListItem
                        key="delete"
                        onClick={() => {
                            setDeleting(menu)
                            setMenu(undefined)
                        }}
                    >
                        <Text>{t('delete')}</Text>
                    </ListItem>
                ]}
            />
            <Confirm
                open={deleting !== undefined}
                onClose={() => setDeleting(undefined)}
                title={t('confirmDelete')}
                description={t('confirmDeleteDescription')}
                confirmText={t('delete')}
                onConfirm={() => {
                    client.api
                        .delete(deleting!)
                        .then(load)
                        .catch((err) => console.error('Failed to delete invitation', err))
                }}
            />
        </div>
    )
}
