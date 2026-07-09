import { useState } from 'react'
import { Button, Text, migrateTheme } from '@concrnt/ui'
import { Theme, CssVar } from '../types/Theme'
import { useThemeLibrary } from '../contexts/Theme'

// Accepts v1/v2 theme JSON in several shapes and normalizes every entry to a v2 Theme:
//   - one or more ```theme ... ``` fenced blocks (shared posts)
//   - a JSON array of themes
//   - a single theme object (has `content` or `palette`)
//   - a Record<name, theme> object (v1 customThemes dump)
const parseThemesInput = (text: string): Theme[] => {
    const trimmed = text.trim()
    if (!trimmed) return []

    const raw: any[] = []
    const fenceRegex = /```theme\s*([\s\S]*?)```/g
    let match: RegExpExecArray | null
    let foundFence = false
    while ((match = fenceRegex.exec(trimmed)) !== null) {
        foundFence = true
        try {
            raw.push(JSON.parse(match[1].trim()))
        } catch (e) {
            console.error(e)
        }
    }

    if (!foundFence) {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
            raw.push(...parsed)
        } else if (parsed && typeof parsed === 'object') {
            if (parsed.content || parsed.palette) {
                raw.push(parsed)
            } else {
                raw.push(...Object.values(parsed))
            }
        }
    }

    return raw.filter(Boolean).map(migrateTheme)
}

interface Props {
    onComplete: () => void
}

export const ThemeImporter = ({ onComplete }: Props) => {
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
            setStatus('JSONの解析に失敗しました')
            return
        }

        if (themes.length === 0) {
            setStatus('テーマが見つかりませんでした')
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
        setStatus(`${added}件追加 / ${skipped}件スキップ`)
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
            <Text variant="h3">v1からインポート</Text>
            <Text variant="caption">
                v1のテーマ設定で「全部コピー」したJSON、または ```theme
                ブロックを貼り付けてください。既存と同名のテーマはスキップします。
            </Text>
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ここにJSONを貼り付け"
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
                    インポート
                </Button>
                {status && <Text variant="caption">{status}</Text>}
            </div>
        </div>
    )
}
