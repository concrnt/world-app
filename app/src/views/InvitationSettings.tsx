import { Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCode } from 'react-qrcode-logo'
import { Button, Checkbox, CopyButton, Text, TextField, View } from '@concrnt/ui'
import { Document } from '@concrnt/client'
import { InvitationSchema, Schemas, semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useSubscribe } from '../hooks/useSubscribe'
import { ListName } from '../components/ListName'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'

export const InvitationSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.invitationSettings' })

    return (
        <View>
            <Header>{t('title')}</Header>
            <Suspense fallback={<Text>Loading...</Text>}>
                <InvitationForm />
            </Suspense>
        </View>
    )
}

const InvitationForm = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.invitationSettings' })
    const { client } = useClient()
    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const [comment, setComment] = useState('')
    const [selected, setSelected] = useState<string[]>([])
    const [invitationURI, setInvitationURI] = useState<string>()

    return (
        <div
            style={{
                flex: 1,
                overflowY: 'auto',
                touchAction: 'pan-y',
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(3),
                padding: CssVar.space(4)
            }}
        >
            <Text style={{ color: CssVar.contentTextDim }}>{t('description')}</Text>
            <Text variant="h3">{t('comment')}</Text>
            <TextField value={comment} onChange={(e) => setComment(e.target.value)} placeholder="welcome!" />
            <Text variant="h3">{t('lists')}</Text>
            <Text variant="caption" style={{ color: CssVar.contentTextDim }}>
                {t('listsDescription')}
            </Text>
            {pinnedLists.map((pin) => (
                <label key={pin.uri} style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(2) }}>
                    <Checkbox
                        checked={selected.includes(pin.uri)}
                        onChange={(checked) =>
                            setSelected(checked ? [...selected, pin.uri] : selected.filter((uri) => uri !== pin.uri))
                        }
                    />
                    <ListName pin={pin} />
                </label>
            ))}
            <Button
                disabled={selected.length === 0}
                busyChildren={t('creating')}
                onClick={async () => {
                    const id = Date.now().toString()
                    const document: Document<InvitationSchema> = {
                        kind: 'record',
                        key: semantics.invitation(client.ccid, id),
                        author: client.ccid,
                        schema: Schemas.invitation,
                        value: {
                            comment: comment || undefined,
                            lists: pinnedLists
                                .filter((pin) => selected.includes(pin.uri))
                                .map((pin) => ({ uri: pin.uri, defaultPostTimelines: pin.defaultPostTimelines }))
                        },
                        createdAt: new Date()
                    }
                    await client.api.commit(document)
                    // 受け手は未登録で、エントリポイントから招待者を解決できるとは限らないのでヒントを付ける
                    setInvitationURI(`cckv://${client.ccid}@${client.entity.domain}/concrnt.world/invitations/${id}`)
                }}
            >
                {t('create')}
            </Button>
            {invitationURI && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                        <Text style={{ flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{invitationURI}</Text>
                        <CopyButton text={invitationURI} style={{ flexShrink: 0 }} />
                    </div>
                    {/* QR は canvas 描画で CSS 変数が使えないので、どのテーマでも読める白黒にする */}
                    <QRCode
                        value={invitationURI}
                        size={500}
                        ecLevel="L"
                        quietZone={30}
                        fgColor="#000000"
                        bgColor="#ffffff"
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                </>
            )}
        </div>
    )
}
