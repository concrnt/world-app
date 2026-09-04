import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox, Text, TextField } from '@concrnt/ui'
import { Document } from '@concrnt/client'
import { ListSchema, Schemas, semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'

export interface ListCreatorProps {
    onBusyChange?: (busy: boolean) => void
    /** Called after commit and before optional pinning; callers own any async work it starts. */
    onCreated?: (uri: string) => void
    onComplete?: () => void
}

export const ListCreator = (props: ListCreatorProps) => {
    const { t } = useTranslation('', { keyPrefix: 'components.listCreator' })
    const { client } = useClient()
    const [newListTitle, setNewListTitle] = useState('')
    const [pinOnCreate, setPinOnCreate] = useState(false)
    const [busy, setBusy] = useState(false)
    const [created, setCreated] = useState(false)
    const [error, setError] = useState<'create' | 'pin' | null>(null)

    const createList = async () => {
        if (!client || created || busy) return

        setError(null)
        setBusy(true)
        props.onBusyChange?.(true)

        try {
            const key = Date.now().toString()
            const uri = semantics.list(client.ccid, client.currentProfile, key)
            const document: Document<ListSchema> = {
                kind: 'record',
                key: uri,
                schema: Schemas.list,
                value: {
                    name: newListTitle
                },
                author: client.ccid,
                createdAt: new Date()
            }

            try {
                await client.api.commit(document)
            } catch (e) {
                console.error('Failed to create list', e)
                setError('create')
                return
            }

            setCreated(true)
            props.onCreated?.(uri)

            if (pinOnCreate) {
                try {
                    await client.addPin(uri)
                } catch (e) {
                    console.error('Failed to pin newly created list', e)
                    setError('pin')
                    return
                }
            }

            props.onComplete?.()
        } finally {
            setBusy(false)
            props.onBusyChange?.(false)
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                width: '100%',
                padding: CssVar.space(2)
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Text variant="h3">{t('createList')}</Text>
                <Button disabled={!newListTitle || created || busy} busyChildren={t('creating')} onClick={createList}>
                    {t('create')}
                </Button>
            </div>
            <fieldset
                disabled={busy || created}
                style={{
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4)
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                    <Text variant="h5">{t('listTitle')}</Text>
                    <TextField value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(2) }}>
                    <Checkbox checked={pinOnCreate} onChange={setPinOnCreate} />
                    {t('pinOnCreate')}
                </label>
            </fieldset>
            {error && (
                <div role="alert" aria-live="assertive">
                    <Text style={{ color: '#ff5b5b' }}>{error === 'create' ? t('createFailed') : t('pinFailed')}</Text>
                </div>
            )}
        </div>
    )
}
