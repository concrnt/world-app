import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { useConfirm } from '../contexts/Confirm'
import type { Document, SignedDocument } from '@concrnt/client'

interface SubkeyEntry {
    key: string
    ckid: string
    status: 'active' | 'revoked'
    enactedAt?: Date
    revokedAt?: Date
    sd: SignedDocument
}

// ID管理画面に表示するサブキーの一覧。有効なサブキーはCIP-13にしたがい、
// enactドキュメントをrevoked-subkeyドキュメント(valueにenactのSignedDocumentを
// そのまま埋め込む)で同一キー上書きすることで失効させられる。
export const SubkeyList = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.id.subkeys' })
    const { client } = useClient()
    const confirm = useConfirm()
    const [entries, setEntries] = useState<SubkeyEntry[] | null>(null)
    const [error, setError] = useState('')

    const currentCKID = client?.api.authProvider.getCKID()
    const canSignMaster = client?.api.authProvider.canSignMaster() ?? false

    const fetchEntries = useCallback(async (): Promise<SubkeyEntry[]> => {
        if (!client) return []
        const results = await client.api.query({
            prefix: `cckv://${client.ccid}/keys/`,
            limit: 100
        })
        const parsed: SubkeyEntry[] = []
        for (const sd of results) {
            try {
                const doc: Document<any> = JSON.parse(sd.document)
                if (doc.schema === 'https://schema.concrnt.net/subkey.json') {
                    parsed.push({
                        key: sd.cckv,
                        ckid: doc.value.ckid,
                        status: 'active',
                        enactedAt: new Date(doc.createdAt),
                        sd
                    })
                } else if (doc.schema === 'https://schema.concrnt.net/revoked-subkey.json') {
                    const enact: Document<any> = JSON.parse(doc.value.document)
                    parsed.push({
                        key: sd.cckv,
                        ckid: enact.value?.ckid ?? '',
                        status: 'revoked',
                        enactedAt: new Date(enact.createdAt),
                        revokedAt: new Date(doc.createdAt),
                        sd
                    })
                }
            } catch (err) {
                console.error('failed to parse subkey document', err)
            }
        }
        return parsed
    }, [client])

    useEffect(() => {
        fetchEntries()
            .then((parsed) => {
                setEntries(parsed)
                setError('')
            })
            .catch((err) => {
                console.error('failed to load subkeys', err)
                setEntries([])
                setError(t('loadFailed'))
            })
    }, [fetchEntries, t])

    if (!client) return null

    const revoke = (entry: SubkeyEntry) => {
        confirm.open(
            t('revokeConfirmTitle'),
            () => {
                client.api
                    .commit(
                        {
                            kind: 'record',
                            key: entry.key,
                            author: client.ccid,
                            schema: 'https://schema.concrnt.net/revoked-subkey.json',
                            value: { document: entry.sd.document, proof: entry.sd.proof },
                            createdAt: new Date()
                        },
                        client.server.domain,
                        { useMasterkey: true }
                    )
                    .then(() => fetchEntries())
                    .then((parsed) => {
                        setEntries(parsed)
                    })
                    .catch((err) => {
                        console.error('failed to revoke subkey', err)
                        setError(t('revokeFailed'))
                    })
            },
            {
                description:
                    entry.ckid === currentCKID ? t('revokeConfirmCurrentDescription') : t('revokeConfirmDescription'),
                confirmText: t('revoke')
            }
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                <Text variant="h3">{t('title')}</Text>
                <Text variant="caption">{t('description')}</Text>
            </div>
            {error && <Text style={{ color: '#ff7676' }}>{error}</Text>}
            {entries === null ? (
                <Text variant="caption">{t('loading')}</Text>
            ) : entries.length === 0 ? (
                <Text variant="caption">{t('empty')}</Text>
            ) : (
                entries.map((entry) => (
                    <div
                        key={entry.key}
                        style={{
                            border: `1px solid ${CssVar.divider}`,
                            borderRadius: '8px',
                            padding: CssVar.space(2),
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(2),
                            opacity: entry.status === 'revoked' ? 0.6 : 1
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(0.5),
                                minWidth: 0,
                                flex: 1
                            }}
                        >
                            <Text
                                style={{
                                    margin: 0,
                                    fontFamily: 'monospace',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {entry.ckid || entry.key}
                                {entry.ckid === currentCKID && ` (${t('current')})`}
                            </Text>
                            <Text variant="caption" style={{ margin: 0 }}>
                                {entry.status === 'active'
                                    ? t('enactedAt', { date: entry.enactedAt?.toLocaleString() })
                                    : t('validPeriod', {
                                          from: entry.enactedAt?.toLocaleString(),
                                          until: entry.revokedAt?.toLocaleString()
                                      })}
                            </Text>
                        </div>
                        {entry.status === 'revoked' ? (
                            <Text variant="caption" style={{ margin: 0, flexShrink: 0 }}>
                                {t('revoked')}
                            </Text>
                        ) : canSignMaster ? (
                            <Button variant="outlined" onClick={() => revoke(entry)} style={{ flexShrink: 0 }}>
                                {t('revoke')}
                            </Button>
                        ) : null}
                    </div>
                ))
            )}
            {!canSignMaster && <Text variant="caption">{t('masterKeyRequired')}</Text>}
        </div>
    )
}
