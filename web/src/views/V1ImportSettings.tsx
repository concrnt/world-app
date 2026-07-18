import { Button, Text } from '@concrnt/ui'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type RepositoryImportResult } from '@concrnt/client'
import {
    convertV1Backup,
    prepareV1Import,
    importRepositoryDump,
    type V1ConversionResult,
    type ImportProgress
} from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useConfirm } from '../contexts/Confirm'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'

export const V1ImportSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.v1ImportSettings' })
    const { client } = useClient()
    const confirm = useConfirm()

    const fileInputRef = useRef<HTMLInputElement>(null)

    const [step, setStep] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [backupText, setBackupText] = useState('')
    const [conversion, setConversion] = useState<V1ConversionResult | null>(null)
    const [progress, setProgress] = useState<ImportProgress | null>(null)
    const [importedCount, setImportedCount] = useState(0)
    const [failures, setFailures] = useState<RepositoryImportResult[]>([])

    const canImport = client.api.authProvider.canSignSub()

    const loadFile = (file: File) => {
        setError(null)
        const reader = new FileReader()
        reader.onload = () => {
            try {
                const text = String(reader.result ?? '')
                const result = convertV1Backup(text, client.ccid)
                if (result.oldCcid === '') {
                    setError(t('step0.parseError'))
                    return
                }
                setBackupText(text)
                setConversion(result)
                setStep(1)
            } catch (err) {
                console.error('failed to convert v1 backup', err)
                setError(t('step0.parseError'))
            }
        }
        reader.onerror = () => {
            setError(t('step0.readError'))
        }
        reader.readAsText(file)
    }

    const runImport = async () => {
        setBusy(true)
        setError(null)
        try {
            const preparation = await prepareV1Import(client.api, backupText)
            const results = await importRepositoryDump(client.api, client.api.defaultHost, preparation.lines, {
                onProgress: (p) => {
                    setProgress({ ...p })
                }
            })
            setImportedCount(preparation.lines.length - results.length)
            setFailures(results)
            setStep(3)
        } catch (err) {
            console.error('failed to import v1 backup', err)
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setBusy(false)
        }
    }

    const skippedCount = conversion
        ? Object.values(conversion.skippedByType).reduce((a, b) => a + b, 0) + conversion.skippedOtherSigner
        : 0

    const steps: Array<{ title: string; content: React.ReactNode }> = [
        {
            title: t('step0.title'),
            content: (
                <>
                    <Text style={{ opacity: 0.8 }}>{t('step0.desc')}</Text>
                    <input
                        type="file"
                        accept=".txt,.log"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) loadFile(file)
                            e.target.value = ''
                        }}
                    />
                    <Button disabled={busy} onClick={() => fileInputRef.current?.click()}>
                        {t('step0.selectFile')}
                    </Button>
                </>
            )
        },
        {
            title: t('step1.title'),
            content: (
                <>
                    {conversion && (
                        <>
                            <Text style={{ opacity: 0.8, wordBreak: 'break-all' }}>
                                {t('step1.oldCcid', { ccid: conversion.oldCcid })}
                            </Text>
                            <Text style={{ opacity: 0.8 }}>
                                {t('step1.stats', {
                                    messages: conversion.convertedMessages,
                                    profiles: conversion.convertedProfiles
                                })}
                            </Text>
                            <Text style={{ opacity: 0.8 }}>
                                {t('step1.excluded', {
                                    deleted: conversion.deleted,
                                    skipped: skippedCount,
                                    invalid: conversion.invalidLines.length
                                })}
                            </Text>
                            {conversion.externalReferences > 0 && (
                                <Text style={{ opacity: 0.8 }}>
                                    {t('step1.externalReferences', { count: conversion.externalReferences })}
                                </Text>
                            )}
                            <Button
                                disabled={busy || conversion.lines.length === 0}
                                onClick={() => {
                                    setStep(2)
                                }}
                            >
                                {t('step1.next')}
                            </Button>
                            <Button
                                variant="outlined"
                                disabled={busy}
                                onClick={() => {
                                    setConversion(null)
                                    setBackupText('')
                                    setStep(0)
                                }}
                            >
                                {t('step1.back')}
                            </Button>
                        </>
                    )}
                </>
            )
        },
        {
            title: t('step2.title'),
            content: (
                <>
                    <Text style={{ opacity: 0.8 }}>{t('step2.desc')}</Text>
                    {progress && (
                        <Text style={{ opacity: 0.8 }}>
                            {t('step2.progress', {
                                done: progress.doneChunks,
                                total: progress.totalChunks,
                                imported: progress.importedLines
                            })}
                        </Text>
                    )}
                    <Button
                        disabled={busy}
                        onClick={() => {
                            confirm.open(t('step2.confirmTitle'), runImport, {
                                description: t('step2.confirmDesc'),
                                confirmText: t('step2.exec')
                            })
                        }}
                    >
                        {busy ? t('step2.working') : t('step2.exec')}
                    </Button>
                </>
            )
        },
        {
            title: t('step3.title'),
            content: (
                <>
                    <Text style={{ opacity: 0.8 }}>{t('step3.desc', { count: importedCount })}</Text>
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
                            <Text style={{ color: '#ff5b5b' }}>{t('step3.failures', { count: failures.length })}</Text>
                            {failures.slice(0, 20).map((failure, i) => (
                                <Text key={i} variant="caption" style={{ opacity: 0.7, wordBreak: 'break-all' }}>
                                    {failure.error}
                                </Text>
                            ))}
                        </div>
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
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <Text style={{ opacity: 0.8 }}>{t('description')}</Text>

                {!canImport ? (
                    <Text style={{ color: '#ff5b5b' }}>{t('subkeyRequired')}</Text>
                ) : (
                    steps.map((s, i) => (
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
                                    {error && <Text style={{ color: '#ff5b5b', wordBreak: 'break-all' }}>{error}</Text>}
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </View>
    )
}
