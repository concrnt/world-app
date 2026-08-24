import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { CCEditor } from './CCEditor'
import { ErrorCodeRegistrationNotFound, fetchWithTimeout, NotFoundError, type Registration } from '@concrnt/client'

// ID管理画面のHome Serverタイルから開くドロワーの中身。
// ホームサーバー上の登録情報(entity meta)を確認・編集する。
// metaは登録時にregister-templateスキーマのフォームで入力した値の生JSON。
export const RegistrationInfo = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.id.homeServer' })
    const { client, logout } = useClient()
    const [registration, setRegistration] = useState<Registration | null>(null)
    // undefined: 取得中 / null: 取得失敗(register-template未配置サーバー)
    const [schema, setSchema] = useState<any>(undefined)
    const [meta, setMeta] = useState<any>(null)
    const [notRegistered, setNotRegistered] = useState(false)
    const [fetchFailed, setFetchFailed] = useState(false)
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [archiveState, setArchiveState] = useState<'idle' | 'downloading' | 'done' | 'failed'>('idle')
    const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'failed'>('idle')

    const host = client?.api.defaultHost

    useEffect(() => {
        if (!client || !host) return
        client.api
            .getRegistration(host)
            .then((reg) => {
                setRegistration(reg)
                setMeta(reg.meta ?? {})
            })
            .catch((err) => {
                if (err instanceof NotFoundError && err.code === ErrorCodeRegistrationNotFound) {
                    setNotRegistered(true)
                } else {
                    console.error('failed to load registration', err)
                    setFetchFailed(true)
                }
            })
    }, [client, host])

    // 編集フォームのスキーマは登録時と同じregister-template。
    // 未配置のサーバーではフォームを出さず、読み取り専用のJSON表示にフォールバックする
    useEffect(() => {
        if (!host) return
        fetchWithTimeout(`https://${host}/register-template`, { method: 'GET' })
            .then((res) => {
                if (!res.ok) throw new Error('register-template unavailable')
                return res.json()
            })
            .then((s) => setSchema(s))
            .catch(() => setSchema(null))
    }, [host])

    if (!client) return null

    const save = () => {
        setSaveState('saving')
        client.api
            .updateRegistration(meta, host)
            .then(() => {
                setSaveState('saved')
            })
            .catch((err) => {
                console.error('failed to update registration', err)
                setSaveState('failed')
            })
    }

    const downloadArchive = async () => {
        setArchiveState('downloading')
        try {
            const dump = await client.api.dumpRepository(host)
            const blob = new Blob([dump], { type: 'application/x-ndjson' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `${client.ccid}-backup-${new Date().toISOString().slice(0, 10)}.jsonl`
            anchor.click()
            URL.revokeObjectURL(url)
            setArchiveState('done')
        } catch (err) {
            console.error('failed to download archive', err)
            setArchiveState('failed')
        }
    }

    const deleteAccount = async () => {
        setDeleteState('deleting')
        try {
            await client.api.unregister(host)
        } catch (err) {
            console.error('failed to unregister', err)
            setDeleteState('failed')
            return
        }
        // 削除成功後はセッションを破棄(webは鍵保持ログアウト: マスターキーは残る)
        await logout()
    }

    const loading = registration === null && !notRegistered && !fetchFailed

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                <Text variant="h3">{t('title')}</Text>
                <Text variant="caption">{t('description')}</Text>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                <Text variant="caption" style={{ margin: 0 }}>
                    {t('domain')}
                </Text>
                <Text style={{ margin: 0, fontFamily: 'monospace' }}>{host}</Text>
            </div>

            {registration?.inviter && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                    <Text variant="caption" style={{ margin: 0 }}>
                        {t('inviter')}
                    </Text>
                    <Text
                        style={{
                            margin: 0,
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {registration.inviter}
                    </Text>
                </div>
            )}

            {loading ? (
                <Text variant="caption">{t('loading')}</Text>
            ) : fetchFailed ? (
                <Text style={{ color: '#ff7676' }}>{t('fetchError')}</Text>
            ) : notRegistered ? (
                <Text variant="caption">{t('notRegistered')}</Text>
            ) : schema === undefined ? (
                <Text variant="caption">{t('loading')}</Text>
            ) : schema === null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                    <Text variant="caption">{t('schemaUnavailable')}</Text>
                    <Text
                        style={{
                            margin: 0,
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            border: `1px solid ${CssVar.divider}`,
                            borderRadius: '8px',
                            padding: CssVar.space(2)
                        }}
                    >
                        {JSON.stringify(registration?.meta ?? null, null, 2)}
                    </Text>
                </div>
            ) : (
                <>
                    <CCEditor
                        schema={schema}
                        value={meta}
                        setValue={(v) => {
                            setMeta(v)
                            setSaveState('idle')
                        }}
                    />
                    <Button disabled={saveState === 'saving'} onClick={save}>
                        {saveState === 'saved' ? t('saved') : t('save')}
                    </Button>
                    {saveState === 'failed' && <Text style={{ color: '#ff7676' }}>{t('saveError')}</Text>}
                </>
            )}

            {/* 未登録でも表示する: migration失敗などでmetaだけ消えた半端な状態の掃除導線を兼ねる
                (unregisterは冪等)。fetchFailed時は状態不明の破壊操作を防ぐため隠す */}
            {!loading && !fetchFailed && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(0.5),
                        borderTop: `1px solid ${CssVar.divider}`,
                        marginTop: CssVar.space(2),
                        paddingTop: CssVar.space(2)
                    }}
                >
                    <Text variant="h3" style={{ color: '#ff7676' }}>
                        {t('dangerZone.title')}
                    </Text>
                    <Button
                        variant="text"
                        style={{ color: '#ff7676' }}
                        onClick={() => {
                            setDeleteModalOpen(true)
                        }}
                    >
                        {t('dangerZone.deleteAccount')}
                    </Button>
                </div>
            )}
            <Modal
                open={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false)
                    setDeleteState('idle')
                }}
            >
                <Text variant="h3">{t('dangerZone.confirmTitle')}</Text>
                <Text variant="caption">{t('dangerZone.warning')}</Text>
                <Button disabled={archiveState === 'downloading'} onClick={downloadArchive}>
                    {archiveState === 'done' ? t('dangerZone.downloaded') : t('dangerZone.downloadArchive')}
                </Button>
                {archiveState === 'failed' && (
                    <Text style={{ color: '#ff5b5b' }}>{t('dangerZone.downloadFailed')}</Text>
                )}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: CssVar.space(1),
                        marginTop: CssVar.space(2)
                    }}
                >
                    <Button
                        onClick={() => {
                            setDeleteModalOpen(false)
                            setDeleteState('idle')
                        }}
                    >
                        {t('dangerZone.cancel')}
                    </Button>
                    <Button disabled={deleteState === 'deleting'} style={{ color: '#ff7676' }} onClick={deleteAccount}>
                        {t('dangerZone.delete')}
                    </Button>
                </div>
                {deleteState === 'failed' && <Text style={{ color: '#ff5b5b' }}>{t('dangerZone.deleteFailed')}</Text>}
            </Modal>
        </div>
    )
}
