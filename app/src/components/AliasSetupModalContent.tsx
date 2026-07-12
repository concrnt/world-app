import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Document } from '@concrnt/client'
import { Button, CopyButton, Text, TextField } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'

interface Props {
    onClose: () => void
}

export const AliasSetupModalContent = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.aliasSetup' })
    const { client, reload } = useClient()

    const [input, setInput] = useState<string>(client?.entity.alias ?? '')
    const [saving, setSaving] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!client) return null

    const alias = input.trim().replace(/^@/, '')
    const aliasValid = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(alias)
    const recordName = `_concrnt.${alias}`
    const recordValue = `cckv://${client.ccid}@${client.entity.domain}`
    const canSignMaster = client.api.authProvider.canSignMaster()

    const submit = async () => {
        setSaving(true)
        setError(null)
        const document: Document<{ domain: string; alias: string }> = {
            kind: 'entity',
            key: `cckv://${client.ccid}`,
            schema: 'https://schema.concrnt.net/entity.json',
            value: {
                domain: client.entity.domain,
                alias
            },
            author: client.ccid,
            createdAt: new Date()
        }
        try {
            await client.api.commit(document, undefined, { useMasterkey: true })
            setDone(true)
            reload()
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            if (message.includes('alias ownership verification failed')) {
                setError(t('verificationFailed'))
            } else {
                setError(t('genericError', { message }))
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2)
            }}
        >
            <Text variant="h3">{t('title')}</Text>

            {done ? (
                <>
                    <Text>{t('success')}</Text>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={props.onClose}>{t('close')}</Button>
                    </div>
                </>
            ) : (
                <>
                    <Text variant="caption">{t('description')}</Text>

                    <TextField
                        placeholder={t('domainPlaceholder')}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />

                    {aliasValid && (
                        <>
                            <Text variant="caption">{t('dnsInstruction')}</Text>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                                    <Text variant="caption" style={{ margin: 0, width: '56px', flexShrink: 0 }}>
                                        {t('recordName')}
                                    </Text>
                                    <div
                                        style={{
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap',
                                            overflowX: 'auto',
                                            flex: 1,
                                            padding: CssVar.space(1),
                                            border: `1px solid ${CssVar.divider}`,
                                            borderRadius: '4px'
                                        }}
                                    >
                                        {recordName}
                                    </div>
                                    <CopyButton text={recordName} />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                                    <Text variant="caption" style={{ margin: 0, width: '56px', flexShrink: 0 }}>
                                        {t('recordType')}
                                    </Text>
                                    <div
                                        style={{
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap',
                                            overflowX: 'auto',
                                            flex: 1,
                                            padding: CssVar.space(1),
                                            border: `1px solid ${CssVar.divider}`,
                                            borderRadius: '4px'
                                        }}
                                    >
                                        TXT
                                    </div>
                                    <div style={{ width: '32px', flexShrink: 0 }} />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                                    <Text variant="caption" style={{ margin: 0, width: '56px', flexShrink: 0 }}>
                                        {t('recordValue')}
                                    </Text>
                                    <div
                                        style={{
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap',
                                            overflowX: 'auto',
                                            flex: 1,
                                            padding: CssVar.space(1),
                                            border: `1px solid ${CssVar.divider}`,
                                            borderRadius: '4px'
                                        }}
                                    >
                                        {recordValue}
                                    </div>
                                    <CopyButton text={recordValue} />
                                </div>
                            </div>
                        </>
                    )}

                    {!canSignMaster && (
                        <Text variant="caption" style={{ color: '#ff7676' }}>
                            {t('masterKeyRequired')}
                        </Text>
                    )}

                    {error && (
                        <Text variant="caption" style={{ color: '#ff7676' }}>
                            {error}
                        </Text>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1) }}>
                        <Button variant="text" disabled={saving} onClick={props.onClose}>
                            {t('cancel')}
                        </Button>
                        <Button disabled={saving || !aliasValid || !canSignMaster} onClick={submit}>
                            {saving ? t('processing') : t('proceed')}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
