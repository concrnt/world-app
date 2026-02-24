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
