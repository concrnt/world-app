import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text, migrateTheme } from '@concrnt/ui'
import { Theme, CssVar } from '../types/Theme'
import { useThemeLibrary } from '../contexts/Theme'

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

// Accepts v1/v2 theme JSON in several shapes and normalizes every entry to a v2 Theme:
//   - a single theme object (has `content` or `palette`)
//   - a JSON array of themes
//   - a Record<name, theme> object (v1 "全部コピー" export)
const parseThemesInput = (text: string): Theme[] => {
    const value = tryParseJson(text)
    if (!value || typeof value !== 'object') return []

    let raw: any[]
    if (Array.isArray(value)) {
        raw = value
    } else if (value.content || value.palette) {
        raw = [value]
    } else {
        raw = Object.values(value)
    }

    return raw.filter((v) => v && typeof v === 'object').map(migrateTheme)
}

interface Props {
    onComplete: () => void
}

export const ThemeImporter = ({ onComplete }: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.themeImporter' })
    const { customThemes, saveTheme } = useThemeLibrary()
    const [input, setInput] = useState('')
    const [status, setStatus] = useState('')
    const [busy, setBusy] = useState(false)

    const handleImport = async () => {
        let themes: Theme[]
        try {
            themes = parseThemesInput(input)
        } catch (e) {
            console.error(e)
            setStatus(t('parseFailed'))
            return
        }

        if (themes.length === 0) {
            setStatus(t('noThemesFound'))
            return
        }

        setBusy(true)
        const existing = new Set(Object.keys(customThemes))
        let added = 0
        let skipped = 0
        for (const theme of themes) {
            const name = theme.meta?.name
            if (!name || existing.has(name)) {
                skipped++
                continue
            }
            existing.add(name)
            try {
                await saveTheme(theme)
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
