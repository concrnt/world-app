import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Button, View, Text, TextField } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Api, InMemoryAuthProvider, InMemoryKVS, type Document, type RepositoryImportResult } from '@concrnt/client'
import {
    semantics,
    prepareRepositoryDump,
    importRepositoryDump,
    type MigrationPreparation,
    type ImportProgress
} from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useConfirm } from '../contexts/Confirm'
import { getResourceCache } from '../lib/cache'
import { CssVar } from '../types/Theme'
import { Header } from '../ui/Header'
import { MdOpenInBrowser } from 'react-icons/md'

const encodeRegistrationDocument = (input: string) =>
    btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const normalizeFqdn = (input: string) =>
    input
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')

export const MigrationSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.migrationSettings' })
    const { client } = useClient()
    const confirm = useConfirm()

    const currentDomain = client.api.defaultHost

    // 引っ越しは通信量が大きいため、まずWeb版での実施を推奨する案内を挟む
    const [acknowledged, setAcknowledged] = useState(false)

    const [step, setStep] = useState(0)
    const [destinationInput, setDestinationInput] = useState('')
    const [destination, setDestination] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [registrationPageOpened, setRegistrationPageOpened] = useState(false)
    const [preparation, setPreparation] = useState<MigrationPreparation | null>(null)
    const [progress, setProgress] = useState<ImportProgress | null>(null)
    const [failures, setFailures] = useState<RepositoryImportResult[]>([])
    const [cleanupFailed, setCleanupFailed] = useState(false)

    // 移住先での登録完了を自動検知する
    useEffect(() => {
        if (step !== 1 || !registrationPageOpened) return
        const timer = setInterval(async () => {
            const api = new Api(destination, new InMemoryAuthProvider(), new InMemoryKVS())
            const entity = await api.getEntity(client.ccid).catch(() => null)
            if (entity && entity.value.domain === destination) {
                setStep(2)
            }
        }, 3000)
        return () => {
            clearInterval(timer)
        }
    }, [step, registrationPageOpened, destination, client.ccid])

    const checkDestination = async () => {
        setBusy(true)
        setError(null)
        try {
            const fqdn = normalizeFqdn(destinationInput)
            if (!fqdn || fqdn === currentDomain) {
                setError(t('step0.sameDomain'))
                return
            }
            const api = new Api(fqdn, new InMemoryAuthProvider(), new InMemoryKVS())
            await api.getServer(fqdn)
            setDestination(fqdn)
            setStep(1)
        } catch (err) {
            console.error('failed to resolve destination domain', err)
            setError(t('step0.resolveError'))
        } finally {
            setBusy(false)
        }
    }

    const openRegistrationPage = async () => {
        setError(null)
        try {
            const document = {
                kind: 'entity' as const,
                author: client.ccid,
                schema: 'https://schema.concrnt.net/entity.json',
                value: {
                    domain: destination
                },
                createdAt: new Date().toISOString()
            }
            const docString = JSON.stringify(document)
            const signature = await client.api.authProvider.signMaster(docString)
            const encodedDoc = encodeRegistrationDocument(docString)

            openUrl(`https://${destination}/register?document=${encodedDoc}&signature=${signature}`, 'inAppBrowser')
            setRegistrationPageOpened(true)
        } catch (err) {
            console.error('failed to open registration page', err)
            setError(err instanceof Error ? err.message : String(err))
        }
    }

    const prepare = async () => {
        setBusy(true)
        setError(null)
        try {
            // 再署名済みcommitの検証で移住先が現在のsubkeyを解決できるよう、
            // インポートより先にsubkeyを移住先で有効化しておく
            const ckid = client.api.authProvider.getCKID()
            if (!ckid) throw new Error('subkey not available')
            const subkeyDoc: Document<{ ckid: string }> = {
                kind: 'record',
                key: semantics.subkey(client.ccid, ckid),
                author: client.ccid,
                schema: 'https://schema.concrnt.net/subkey.json',
                value: {
                    ckid
                },
                createdAt: new Date()
            }
            await client.api.commit(subkeyDoc, destination, { useMasterkey: true })

            const dump = await client.api.dumpRepository(currentDomain)

            const prep = await prepareRepositoryDump(client.api, dump)
            setPreparation(prep)
            setStep(3)
        } catch (err) {
            console.error('failed to prepare migration', err)
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    const runImport = async () => {
        if (!preparation) return
        setBusy(true)
        setError(null)
        try {
            const results = await importRepositoryDump(client.api, destination, preparation.lines, {
                onProgress: (p) => {
                    setProgress({ ...p })
                }
            })
            setFailures(results)
            setStep(4)
        } catch (err) {
            console.error('failed to import repository', err)
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    const switchSession = async () => {
        await invoke('set_domain', { domain: destination, ccid: client.ccid })
        await getResourceCache(client.ccid).clear()
        window.location.reload()
    }

    const finalize = async (skipCleanup: boolean) => {
        setBusy(true)
        setError(null)
        try {
            if (!skipCleanup) {
                // 移住先での登録commitは旧サーバーに配送されないため、
                // 新しいentity docを旧サーバーにもcommitして所属を移住先へ更新してから
                // 旧サーバーの登録(entity meta)を解除する
                const entityDoc: Document<{ domain: string }> = {
                    kind: 'entity',
                    author: client.ccid,
                    schema: 'https://schema.concrnt.net/entity.json',
                    value: {
                        domain: destination
                    },
                    createdAt: new Date()
                }
                await client.api.commit(entityDoc, currentDomain, { useMasterkey: true })
                await client.api.unregister(currentDomain)
            }
            await switchSession()
        } catch (err) {
            console.error('failed to clean up the old server registration', err)
            setCleanupFailed(true)
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    const steps: Array<{ title: string; content: React.ReactNode }> = [
        {
            title: t('step0.title'),
            content: (
                <>
                    <Text style={{ opacity: 0.8 }}>{t('step0.desc')}</Text>
                    <TextField
                        value={destinationInput}
                        placeholder={t('step0.placeholder')}
                        onChange={(e) => setDestinationInput(e.target.value)}
                    />
                    <Button disabled={busy || !destinationInput} onClick={checkDestination}>
                        {t('step0.next')}
                    </Button>
                </>
            )
        },
        {
            title: t('step1.title'),
            content: (
                <>
                    <Text style={{ opacity: 0.8 }}>{t('step1.desc', { domain: destination })}</Text>
                    <Button onClick={openRegistrationPage}>{t('step1.open')}</Button>
                    {registrationPageOpened && <Text style={{ opacity: 0.8 }}>{t('step1.waiting')}</Text>}
                </>
            )
        },
        {
            title: t('step2.title'),
            content: (
                <>
                    <Text style={{ opacity: 0.8 }}>{t('step2.desc')}</Text>
                    <Button disabled={busy} onClick={prepare}>
                        {busy ? t('step2.working') : t('step2.exec')}
                    </Button>
                </>
            )
        },
        {
            title: t('step3.title'),
            content: (
                <>
                    <Text style={{ opacity: 0.8 }}>{t('step3.desc')}</Text>
                    {preparation && (
                        <Text style={{ opacity: 0.8 }}>
                            {t('step3.stats', {
                                total: preparation.lines.length,
                                resigned: preparation.resigned,
                                skipped: preparation.skipped.length
                            })}
                        </Text>
                    )}
                    {progress && (
                        <Text style={{ opacity: 0.8 }}>
                            {t('step3.progress', {
                                done: progress.doneChunks,
                                total: progress.totalChunks,
                                imported: progress.importedLines
                            })}
                        </Text>
                    )}
                    <Button
                        disabled={busy}
                        onClick={() => {
                            confirm.open(t('step3.confirmTitle'), runImport, {
                                description: t('step3.confirmDesc', { domain: destination }),
                                confirmText: t('step3.exec')
                            })
                        }}
                    >
                        {busy ? t('step3.working') : t('step3.exec')}
                    </Button>
                </>
            )
        },
        {
            title: t('step4.title'),
            content: (
                <>
                    <Text style={{ opacity: 0.8 }}>{t('step4.desc', { domain: destination })}</Text>
                    {failures.length > 0 && (
                        <div
                            style={{
                                border: `1px solid ${CssVar.divider}`,
                                borderRadius: CssVar.round(1),
                                padding: CssVar.space(1.5),
                                maxHeight: 200,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(0.5)
                            }}
                        >
                            <Text style={{ color: '#ff5b5b' }}>{t('step4.failures', { count: failures.length })}</Text>
                            {failures.slice(0, 20).map((failure, i) => (
                                <Text key={i} variant="caption" style={{ opacity: 0.7, wordBreak: 'break-all' }}>
                                    {failure.error}
                                </Text>
                            ))}
                        </div>
                    )}
                    {cleanupFailed && <Text style={{ color: '#ff5b5b' }}>{t('step4.cleanupError')}</Text>}
                    <Button disabled={busy} onClick={() => finalize(false)}>
                        {t('step4.exec')}
                    </Button>
                    {cleanupFailed && (
                        <Button variant="outlined" disabled={busy} onClick={() => finalize(true)}>
                            {t('step4.skipCleanup')}
                        </Button>
                    )}
                </>
            )
        }
    ]

    return (
        <View>
            <Header>{t('title')}</Header>
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
                {!acknowledged ? (
                    <>
                        <div
                            style={{
                                border: `1px solid ${CssVar.divider}`,
                                borderRadius: CssVar.round(1),
                                padding: CssVar.space(2.5),
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(2),
                                alignItems: 'center'
                            }}
                        >
                            <MdOpenInBrowser size={42} style={{ color: CssVar.contentLink }} />
                            <Text style={{ fontWeight: 700 }}>{t('webRecommendedTitle')}</Text>
                            <Text style={{ opacity: 0.8, lineHeight: 1.65 }}>{t('webRecommendedDesc')}</Text>
                        </div>
                        <Button variant="outlined" onClick={() => setAcknowledged(true)}>
                            {t('continueOnApp')}
                        </Button>
                    </>
                ) : (
                    <>
                        <Text style={{ opacity: 0.8 }}>{t('description')}</Text>
                        {steps.map((s, i) => (
                            <div
                                key={i}
                                style={{
                                    border: `1px solid ${CssVar.divider}`,
                                    borderRadius: CssVar.round(1),
                                    padding: CssVar.space(2),
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: CssVar.space(1.5),
                                    opacity: i === step ? 1 : 0.5
                                }}
                            >
                                <Text style={{ fontWeight: 700 }}>
                                    {i + 1}. {s.title}
                                    {i < step ? ' ✓' : ''}
                                </Text>
                                {i === step && (
                                    <>
                                        {s.content}
                                        {error && (
                                            <Text style={{ color: '#ff5b5b', wordBreak: 'break-all' }}>{error}</Text>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>
        </View>
    )
}
