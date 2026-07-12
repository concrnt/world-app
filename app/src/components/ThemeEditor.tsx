import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton, Text, TextField } from '@concrnt/ui'
import { MdContentCopy, MdSave } from 'react-icons/md'
import { Theme } from '../types/Theme'
import { Themes } from '../data/themes'
import { usePreference } from '../contexts/Preference'
import { useThemeLibrary } from '../contexts/Theme'
import { ThemeCard } from './ThemeCard'
import { CssVar } from '../types/Theme'

const cloneTheme = (theme: Theme, name: string): Theme => ({
    ...theme,
    content: { ...theme.content },
    ui: { ...theme.ui },
    backdrop: { ...theme.backdrop },
    meta: {
        ...theme.meta,
        name
    }
})

const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value)

interface Props {
    baseTheme: Theme
    baseName: string
}

export const ThemeEditor = ({ baseTheme, baseName }: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.themeEditor' })
    const [themeName, setThemeName] = usePreference('themeName')
    const { customThemes, saveTheme } = useThemeLibrary()
    const [title, setTitle] = useState(() => (baseName in Themes ? `${baseName}-custom` : baseName))
    const [draft, setDraft] = useState<Theme>(() => cloneTheme(baseTheme, baseName))
    const [status, setStatus] = useState('')
    const normalizedTitle = title.trim()

    const savedTheme = useMemo(
        () =>
            cloneTheme(
                {
                    ...draft,
                    meta: {
                        ...draft.meta,
                        name: normalizedTitle
                    }
                },
                normalizedTitle
            ),
        [draft, normalizedTitle]
    )

    const protectedName = normalizedTitle in Themes
    const exists = customThemes[normalizedTitle] !== undefined

    const updateDraft = (patch: Partial<Theme>) => {
        setDraft((prev) => ({
            ...prev,
            ...patch
        }))
    }

    const updateSection = <K extends 'content' | 'ui' | 'backdrop'>(section: K, key: keyof Theme[K], value: string) => {
        setDraft((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }))
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(3),
                border: `1px solid ${CssVar.divider}`,
                borderRadius: CssVar.round(1),
                padding: CssVar.space(3)
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: CssVar.space(2),
                    flexWrap: 'wrap'
                }}
            >
                <Text variant="h3">{t('title')}</Text>
                <div style={{ display: 'flex', gap: CssVar.space(1), flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        disabled={protectedName || normalizedTitle.length === 0}
                        startIcon={<MdSave size={18} />}
                        onClick={async () => {
                            const saved = await saveTheme(savedTheme)
                            setThemeName(saved.meta?.name ?? normalizedTitle)
                            setStatus(exists ? t('themeUpdated') : t('themeCreated'))
                        }}
                    >
                        {exists ? t('update') : t('create')}
                    </Button>
                    <IconButton
                        onClick={() => {
                            navigator.clipboard?.writeText(JSON.stringify(savedTheme))
                            setStatus(t('jsonCopied'))
                        }}
                    >
                        <MdContentCopy size={20} />
                    </IconButton>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
                    gap: CssVar.space(3)
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                    <Field label={t('titleLabel')}>
                        <TextField value={title} onChange={(e) => setTitle(e.target.value)} />
                        {protectedName && <Text variant="caption">{t('builtinNameProtected')}</Text>}
                    </Field>

                    <Field label={t('variantLabel')}>
                        <select
                            value={draft.variant}
                            onChange={(e) => updateDraft({ variant: e.target.value as Theme['variant'] })}
                            style={selectStyle}
                        >
                            <option value="classic">classic</option>
                            <option value="world">world</option>
                        </select>
                    </Field>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
                    <Text variant="h5">{t('preview')}</Text>
                    <ThemeCard theme={savedTheme} />
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: CssVar.space(3)
                }}
            >
                <ThemeSection title="Content" foreground={draft.content.text} background={draft.content.background}>
                    <ColorField
                        label="Text"
                        value={draft.content.text}
                        onChange={(value) => updateSection('content', 'text', value)}
                    />
                    <ColorField
                        label="Link"
                        value={draft.content.link}
                        onChange={(value) => updateSection('content', 'link', value)}
                    />
                    <ColorField
                        label="Background"
                        value={draft.content.background}
                        onChange={(value) => updateSection('content', 'background', value)}
                    />
                </ThemeSection>

                <ThemeSection title="UI" foreground={draft.ui.text} background={draft.ui.background}>
                    <ColorField
                        label="Text"
                        value={draft.ui.text}
                        onChange={(value) => updateSection('ui', 'text', value)}
                    />
                    <ColorField
                        label="Background"
                        value={draft.ui.background}
                        onChange={(value) => updateSection('ui', 'background', value)}
                    />
                </ThemeSection>

                <ThemeSection title="Backdrop" foreground={draft.backdrop.text} background={draft.backdrop.background}>
                    <ColorField
                        label="Text"
                        value={draft.backdrop.text}
                        onChange={(value) => updateSection('backdrop', 'text', value)}
                    />
                    <ColorField
                        label="Background"
                        value={draft.backdrop.background}
                        onChange={(value) => updateSection('backdrop', 'background', value)}
                    />
                </ThemeSection>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: CssVar.space(2)
                }}
            >
                <ColorField
                    label="Divider"
                    value={draft.divider}
                    onChange={(value) => updateDraft({ divider: value })}
                />
                <Field label="Space">
                    <TextField value={draft.space} onChange={(e) => updateDraft({ space: e.target.value })} />
                </Field>
                <Field label="Round">
                    <TextField value={draft.round} onChange={(e) => updateDraft({ round: e.target.value })} />
                </Field>
            </div>

            {status && <Text variant="caption">{status}</Text>}
            {themeName === normalizedTitle && <Text variant="caption">{t('currentlyInUse')}</Text>}
        </div>
    )
}

const Field = (props: { label: string; children: React.ReactNode }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
        <Text variant="h5">{props.label}</Text>
        {props.children}
    </label>
)

const ColorField = (props: { label: string; value: string; onChange: (value: string) => void }) => (
    <Field label={props.label}>
        <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
            <TextField value={props.value} onChange={(e) => props.onChange(e.target.value)} />
            <input
                type="color"
                value={isHexColor(props.value) ? props.value : '#000000'}
                onChange={(e) => props.onChange(e.target.value)}
                style={{
                    width: '40px',
                    height: '40px',
                    border: `1px solid ${CssVar.divider}`,
                    borderRadius: CssVar.round(0.5),
                    background: 'transparent',
                    flexShrink: 0
                }}
            />
        </div>
    </Field>
)

const ThemeSection = (props: { title: string; foreground: string; background: string; children: React.ReactNode }) => (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            gap: CssVar.space(2),
            padding: CssVar.space(3),
            borderRadius: CssVar.round(1),
            color: props.foreground,
            backgroundColor: props.background,
            border: `1px solid ${CssVar.divider}`
        }}
    >
        <Text variant="h4">{props.title}</Text>
        {props.children}
    </div>
)

const selectStyle: React.CSSProperties = {
    padding: '8px',
    fontSize: '16px',
    borderRadius: '4px',
    border: `1px solid ${CssVar.divider}`,
    backgroundColor: CssVar.contentBackground,
    color: CssVar.contentText,
    width: '100%',
    boxShadow: 'none',
    outline: 'none'
}
