export interface Theme {
    content: {
        text: string
        link: string
        background: string
    }
    ui: {
        text: string
        background: string
    }
    backdrop: {
        text: string
        background: string
    }
    divider: string
    variant: 'classic' | 'world'
    meta?: any
    space: string
    round: string
}

export const CssVar = {
    contentText: 'var(--content-text)',
    contentLink: 'var(--content-link)',
    contentBackground: 'var(--content-background)',
    uiText: 'var(--ui-text)',
    uiBackground: 'var(--ui-background)',
    backdropText: 'var(--backdrop-text)',
    backdropBackground: 'var(--backdrop-background)',
    divider: 'var(--divider)',
    space: (mul: number) => `calc(var(--space) * ${mul})`,
    round: (mul: number) => `calc(var(--round) * ${mul})`
}

// Loose shape of a v1 (MUI-based) Concrnt theme, as shared/stored by the v1 client.
export interface ThemeV1 {
    meta?: { name?: string; author?: string; comment?: string }
    palette?: {
        primary?: { main?: string; contrastText?: string }
        secondary?: { main?: string }
        background?: { default?: string; paper?: string; contrastText?: string }
        text?: { primary?: string; secondary?: string; disabled?: string }
        divider?: string
    }
    shape?: { borderRadius?: number }
}

// Converts a v1 (palette-based) theme into the v2 (content/ui/backdrop) structure.
// Idempotent: a value that already has `content` (v2 shape) is returned untouched.
export const migrateTheme = (input: any): Theme => {
    if (input && typeof input === 'object' && input.content) {
        return input as Theme
    }

    const v1 = (input ?? {}) as ThemeV1
    const palette = v1.palette ?? {}

    const uiBackground = palette.primary?.main ?? '#0476d9'
    const contentText = palette.text?.primary ?? '#000000'

    return {
        content: {
            text: contentText,
            link: palette.text?.secondary ?? contentText,
            background: palette.background?.paper ?? '#ffffff'
        },
        ui: {
            text: palette.primary?.contrastText ?? '#ffffff',
            background: uiBackground
        },
        backdrop: {
            text: palette.background?.contrastText ?? '#ffffff',
            background: palette.background?.default ?? uiBackground
        },
        divider: palette.divider ?? '#e6e2df',
        variant: 'world',
        space: '4px',
        round: v1.shape?.borderRadius != null ? `${v1.shape.borderRadius}px` : '4px',
        meta: {
            name: v1.meta?.name ?? 'imported'
        }
    }
}
