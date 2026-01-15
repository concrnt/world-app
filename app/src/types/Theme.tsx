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
}
