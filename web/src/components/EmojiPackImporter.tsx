import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useEmojiPicker } from '../contexts/EmojiPicker'

// Tolerant JSON extraction: pasted text often carries leading/trailing junk
// (fence remnants, stray backslashes/newlines, or a once-escaped payload).
const tryParseJson = (chunk: string): any => {
    const t = chunk.trim()
    if (!t) return null

    // 1. as-is
    try {
        return JSON.parse(t)
    } catch {
        /* fall through */
    }

    // 2. slice from the first { or [ to the last } or ] (drops surrounding junk)
    const start = t.search(/[{[]/)
    const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
    if (start < 0 || end <= start) return null
    const sliced = t.slice(start, end + 1)
    try {
        return JSON.parse(sliced)
    } catch {
        /* fall through */
    }

    // 3. last resort: undo one level of escaping (handles \" and literal \n/\t)
    try {
        const unescaped = sliced.replace(/\\"/g, '"').replace(/\\n/g, '').replace(/\\t/g, '')
        return JSON.parse(unescaped)
    } catch {
        return null
    }
}

// Accepts emoji package URLs in several shapes:
//   - a JSON array of URL strings (v1 "全部コピー" export)
//   - a whole v1 preference object ({ emojiPackages: [...] })
//   - a single URL string (with or without JSON quoting)
const parsePackageURLsInput = (text: string): string[] => {
    const value = tryParseJson(text) ?? text.trim()

    let raw: any[]
    if (Array.isArray(value)) {
        raw = value
    } else if (typeof value === 'string') {
        raw = [value]
    } else if (value && typeof value === 'object' && Array.isArray(value.emojiPackages)) {
        raw = value.emojiPackages
    } else {
        return []
    }

    return raw.filter((v): v is string => typeof v === 'string' && /^https?:\/\//.test(v.trim())).map((v) => v.trim())
}

interface Props {
    onComplete: () => void
}

export const EmojiPackImporter = ({ onComplete }: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.emojiPackImporter' })
    const picker = useEmojiPicker()
    const [input, setInput] = useState('')
    const [status, setStatus] = useState('')
    const [busy, setBusy] = useState(false)

    const handleImport = async () => {
        const urls = parsePackageURLsInput(input)
        if (urls.length === 0) {
            setStatus(t('noPackagesFound'))
            return
        }

        setBusy(true)
        const existing = new Set(picker.packageURLs)
        let added = 0
        let skipped = 0
        for (const url of urls) {
            if (existing.has(url)) {
                skipped++
                continue
            }
            existing.add(url)
            try {
                await picker.addEmojiPackage(url)
                added++
            } catch (e) {
                console.error(e)
                skipped++
            }
        }
        setBusy(false)
        setStatus(t('importResult', { added, skipped }))
        onComplete()
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(3),
                padding: CssVar.space(4)
            }}
        >
            <Text variant="h3">{t('title')}</Text>
            <Text variant="caption">{t('description')}</Text>
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('placeholder')}
                rows={10}
                style={{
                    padding: '8px',
                    fontSize: '16px',
                    fontFamily: 'Source Code Pro, monospace',
                    borderRadius: CssVar.round(1),
                    border: `1px solid ${CssVar.divider}`,
                    backgroundColor: CssVar.contentBackground,
                    color: CssVar.contentText,
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    boxShadow: 'none',
                    outline: 'none'
                }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(2) }}>
                <Button disabled={busy || input.trim().length === 0} onClick={handleImport}>
                    {t('import')}
                </Button>
                {status && <Text variant="caption">{status}</Text>}
            </div>
        </div>
    )
}
