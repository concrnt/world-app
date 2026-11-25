import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdMoreHoriz } from 'react-icons/md'
import { Button, Confirm, IconButton, ListItem, Text, TextField, useAnchor } from '@concrnt/ui'
import { Document, SignedDocument } from '@concrnt/client'
import { InvitationSchema, Schemas, semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { TimelinePicker } from '../components/TimelinePicker'
import { TimelineTag } from '../components/TimelineTag'
import { Drawer } from '../components/Drawer'
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
    const [communities, setCommunities] = useState<string[]>([])
    const [additionalCommunities, setAdditionalCommunities] = useState<string[]>([])
    const [additionalOpen, setAdditionalOpen] = useState(false)
    const [created, setCreated] = useState<Document<InvitationSchema>>()
    const [copied, setCopied] = useState(false)
    const [invitations, setInvitations] = useState<SignedDocument[]>([])
    const [listOpen, setListOpen] = useState(false)
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

    // 受け手は未登録で、エントリポイントから招待者を解決できるとは限らないのでヒントを付ける
    const link = created
        ? `https://concrnt.world/invitation/${client.ccid}/${created.key!.split('/').pop()}?hint=${client.entity.domain}`
        : ''

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="h2">{t('createTitle')}</Text>
                <Button variant="text" onClick={() => setListOpen(true)} style={{ padding: 0, fontSize: '0.875em' }}>
                    {t('createdLinks')}
                </Button>
            </div>
            {created ? (
                <>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(1),
                            padding: CssVar.space(2),
                            borderRadius: CssVar.round(1),
                            border: `1px solid ${CssVar.divider}`
                        }}
                    >
                        <Text>{created.value.comment}</Text>
                        {[
                            ...created.value.defaultPostTimelines,
                            ...created.value.timelines.filter((tl) => !created.value.defaultPostTimelines.includes(tl))
                        ].map((tl) => (
                            <TimelineTag key={tl} uri={tl} />
                        ))}
                    </div>
                    <Button
                        onClick={() => {
                            navigator.clipboard.writeText(link)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                        }}
                    >
                        {copied ? t('copied') : t('copyLink')}
                    </Button>
                    {typeof navigator.share === 'function' && (
                        <Button onClick={() => navigator.share({ url: link }).catch(() => {})}>{t('share')}</Button>
                    )}
                    <Button
                        variant="text"
                        onClick={() => setCreated(undefined)}
                        style={{ alignSelf: 'center', padding: 0, fontSize: '0.875em' }}
                    >
                        {t('createAnother')}
                    </Button>
                </>
            ) : (
                <>
                    <Text variant="h3">{t('comment')}</Text>
                    <TextField value={comment} onChange={(e) => setComment(e.target.value)} />
                    <Text variant="h3">{t('communities')}</Text>
                    <TimelinePicker
                        selected={communities}
                        setSelected={setCommunities}
                        addLabel={t('selectCommunity')}
                        single
                    />
                    {additionalOpen ? (
                        <>
                            <Text variant="h3">{t('additionalCommunities')}</Text>
                            <TimelinePicker
                                selected={additionalCommunities}
                                setSelected={setAdditionalCommunities}
                                addLabel={t('selectCommunity')}
                            />
                        </>
                    ) : (
                        <Button
                            variant="text"
                            onClick={() => setAdditionalOpen(true)}
                            style={{ alignSelf: 'flex-start', padding: 0, fontSize: '0.875em' }}
                        >
                            {t('addMoreCommunities')}
                        </Button>
                    )}
                    <Button
                        disabled={comment === '' || communities.length === 0}
                        busyChildren={t('creating')}
                        onClick={async () => {
                            const document: Document<InvitationSchema> = {
                                kind: 'record',
                                key: semantics.invitation(client.ccid, Date.now().toString()),
                                author: client.ccid,
                                schema: Schemas.invitation,
                                value: {
                                    comment,
                                    timelines: [...new Set([...communities, ...additionalCommunities])],
                                    defaultPostTimelines: communities
                                },
                                createdAt: new Date()
                            }
                            await client.api.commit(document)
                            setCreated(document)
                            setComment('Welcome!')
                            setCommunities([])
                            setAdditionalCommunities([])
                            setAdditionalOpen(false)
                            await load()
                        }}
                    >
                        {t('create')}
                    </Button>
                </>
            )}
            <Drawer open={listOpen} onClose={() => setListOpen(false)}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2),
                        padding: CssVar.space(2)
                    }}
                >
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
                                    flexDirection: 'column',
                                    gap: CssVar.space(1),
                                    padding: CssVar.space(2),
                                    borderRadius: CssVar.round(1),
                                    border: `1px solid ${CssVar.divider}`
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                                    <Text style={{ flex: 1, minWidth: 0 }}>{document.value.comment}</Text>
                                    <IconButton
                                        onClick={() => setMenu(sd.cckv)}
                                        style={
                                            {
                                                anchorName: menu === sd.cckv ? menuAnchor : undefined
                                            } as React.CSSProperties
                                        }
                                    >
                                        <MdMoreHoriz size={20} />
                                    </IconButton>
                                </div>
                                {[
                                    ...document.value.defaultPostTimelines,
                                    ...document.value.timelines.filter(
                                        (tl) => !document.value.defaultPostTimelines.includes(tl)
                                    )
                                ].map((tl) => (
                                    <TimelineTag key={tl} uri={tl} />
                                ))}
                            </div>
                        )
                    })}
                </div>
            </Drawer>
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
