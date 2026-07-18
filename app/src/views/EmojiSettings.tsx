import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CCImage, Button, IconButton, Text, TextField, View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { type EmojiPackage, type RawEmojiPackage, useEmojiPicker } from '../contexts/EmojiPicker'
import type { ListEntry } from '@concrnt/worldlib'
import { MdAddCircle, MdCached, MdContentCopy, MdDeleteForever } from 'react-icons/md'

export const EmojiSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.emojiSettings' })
    const picker = useEmojiPicker()

    const [addingPackageURL, setAddingPackageURL] = useState('')
    const [preview, setPreview] = useState<EmojiPackage | null>(null)
    const [status, setStatus] = useState('')

    const packagesByURL = useMemo(() => {
        return new Map(picker.packages.map((pkg) => [pkg.packageURL, pkg]))
    }, [picker.packages])

    useEffect(() => {
        const url = addingPackageURL.trim()
        if (!url) {
            return
        }

        const timer = window.setTimeout(() => {
            fetch(url, { signal: AbortSignal.timeout(5000) })
                .then((res) => res.json())
                .then((pkg: RawEmojiPackage) => {
                    setPreview({
                        ...pkg,
                        packageURL: url,
                        fetchedAt: new Date()
                    })
                    setStatus('')
                })
                .catch(() => {
                    setPreview(null)
                    setStatus(t('packageNotFound'))
                })
        }, 500)

        return () => {
            window.clearTimeout(timer)
        }
    }, [addingPackageURL])

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
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: CssVar.space(2),
                        flexWrap: 'wrap'
                    }}
                >
                    <Text variant="h3">{t('packages')}</Text>
                    <Button
                        variant="outlined"
                        onClick={async () => {
                            await Promise.all(picker.packageURLs.map((url) => picker.updateEmojiPackage(url)))
                            setStatus(t('updated'))
                        }}
                    >
                        {t('updateAll')}
                    </Button>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: CssVar.space(2)
                    }}
                >
                    {picker.packageEntries.map((entry) => {
                        const href = typeof entry.value?.href === 'string' ? entry.value.href : undefined
                        const pkg = href ? packagesByURL.get(href) : undefined
                        return <EmojiPackageCard key={entry.key} entry={entry} pkg={pkg} onStatus={setStatus} />
                    })}
                </div>

                {preview && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(2),
                            border: `1px solid ${CssVar.divider}`,
                            borderRadius: CssVar.round(1),
                            padding: CssVar.space(2)
                        }}
                    >
                        <CCImage
                            src={preview.iconURL}
                            maxHeight={128}
                            alt={preview.name}
                            style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Text variant="h4">{preview.name}</Text>
                            <Text style={{ overflowWrap: 'anywhere', opacity: 0.65 }}>{preview.packageURL}</Text>
                        </div>
                        <IconButton
                            onClick={async () => {
                                if (picker.packageURLs.includes(preview.packageURL)) {
                                    setStatus(t('alreadyAdded'))
                                    return
                                }
                                await picker.addEmojiPackage(preview.packageURL)
                                setAddingPackageURL('')
                                setPreview(null)
                                setStatus(t('added'))
                            }}
                        >
                            <MdAddCircle size={24} />
                        </IconButton>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
                    <Text variant="h5">{t('packageURL')}</Text>
                    <TextField
                        value={addingPackageURL}
                        placeholder="https://example.com/emoji.json"
                        onChange={(e) => {
                            setAddingPackageURL(e.target.value)
                            setPreview(null)
                            setStatus('')
                        }}
                    />
                </div>

                {status && <Text style={{ opacity: 0.7 }}>{status}</Text>}
            </div>
        </View>
    )
}

interface EmojiPackageCardProps {
    entry: ListEntry
    pkg?: EmojiPackage
    onStatus: (status: string) => void
}

const EmojiPackageCard = ({ entry, pkg, onStatus }: EmojiPackageCardProps) => {
    const { t } = useTranslation('', { keyPrefix: 'views.emojiSettings' })
    const picker = useEmojiPicker()

    const href = typeof entry.value?.href === 'string' ? entry.value.href : undefined

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(2),
                minHeight: '72px',
                border: `1px solid ${CssVar.divider}`,
                borderRadius: CssVar.round(1),
                padding: CssVar.space(2),
                boxSizing: 'border-box'
            }}
        >
            {pkg ? (
                <CCImage
                    src={pkg.iconURL}
                    maxHeight={128}
                    alt={pkg.name}
                    style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }}
                />
            ) : (
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: CssVar.round(0.5),
                        backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.08)`,
                        flexShrink: 0
                    }}
                />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
                <Text variant="h4">{pkg?.name ?? (href ? t('loadFailed') : t('brokenEntry'))}</Text>
                <Text style={{ overflowWrap: 'anywhere', opacity: 0.65 }}>
                    {pkg?.fetchedAt
                        ? t('fetchedAt', { date: new Date(pkg.fetchedAt).toLocaleString() })
                        : (href ?? entry.key)}
                </Text>
            </div>
            <div style={{ display: 'flex', gap: CssVar.space(0.5), flexShrink: 0 }}>
                {href && (
                    <IconButton
                        onClick={async () => {
                            await picker.updateEmojiPackage(href)
                            onStatus(t('updated'))
                        }}
                    >
                        <MdCached size={20} />
                    </IconButton>
                )}
                <IconButton
                    onClick={async () => {
                        await navigator.clipboard?.writeText(href ?? entry.key)
                        onStatus(t('urlCopied'))
                    }}
                >
                    <MdContentCopy size={20} />
                </IconButton>
                <IconButton
                    onClick={async () => {
                        await picker.removeEmojiPackage(entry.key)
                        onStatus(t('removed'))
                    }}
                >
                    <MdDeleteForever size={20} />
                </IconButton>
            </div>
        </div>
    )
}
