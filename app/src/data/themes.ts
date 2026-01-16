import { Theme } from '../types/Theme'

export const Themes: Record<string, Theme> = {
    light: {
        content: {
            text: '#000000',
            link: '#0476d9',
            background: '#ffffff'
        },
        ui: {
            text: '#ffffff',
            background: '#0476d9'
        },
        backdrop: {
            text: '#000000',
            background: '#ffffff'
        },
        divider: '#e6e2df',
        variant: 'classic',
        meta: {
            name: 'light'
        }
    },
    darkgray: {
        content: {
            text: '#ffffff',
            link: 'rgba(255, 255, 255, 0.7)',
            background: '#222222'
        },
        ui: {
            text: '#ffffff',
            background: '#555555'
        },
        backdrop: {
            text: '#ffffff',
            background: '#333333'
        },
        divider: '#e6e2df',
        variant: 'classic',
        meta: {
            name: 'darkgray'
        }
    },
    blue: {
        content: {
            text: '#000000',
            link: '#000000',
            background: '#ffffff'
        },
        ui: {
            text: '#ffffff',
            background: '#0476d9'
        },
        backdrop: {
            text: '#ffffff',
            background: '#023059'
        },
        divider: '#e6e2df',
        variant: 'world',
        meta: {
            name: 'blue'
        }
    },
    rainyday: {
        content: {
            text: '#232d31',
            link: 'rgba(52, 61, 66, 0.7)',
            background: '#ebf3f5'
        },
        ui: {
            text: '#ffffff',
            background: '#70868b'
        },
        backdrop: {
            text: '#ffffff',
            background: '#839fa1'
        },
        divider: '#e6e2df',
        variant: 'world',
        meta: {
            name: 'rainyday'
        }
    }
}
