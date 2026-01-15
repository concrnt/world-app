import { Theme } from '../types/Theme'

export const Themes: Record<string, Theme> = {
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
        variant: 'classic',
        meta: {
            name: 'blue'
        }
    },
    blue2: {
        content: {
            text: '#ffffff',
            link: 'rgba(255, 255, 255, 0.8)',
            background: '#202c4b'
        },
        ui: {
            text: '#ffffff',
            background: '#116691'
        },
        backdrop: {
            text: '#dbfafc',
            background: '#211a3d'
        },
        divider: '#e6e2df',
        variant: 'classic',
        meta: {
            name: 'blue2'
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
    cafe: {
        content: {
            text: '#000000',
            link: '#000000',
            background: '#f7efea'
        },
        ui: {
            text: '#ffffff',
            background: '#663741'
        },
        backdrop: {
            text: '#ffffff',
            background: '#a99996'
        },
        divider: '#e6e2df',
        variant: 'classic',
        meta: {
            name: 'cafe'
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
        variant: 'classic',
        meta: {
            name: 'rainyday'
        }
    },
    sacher: {
        content: {
            text: '#2e0d03',
            link: '#4c6675',
            background: '#f6f1e0'
        },
        ui: {
            text: '#fffefa',
            background: '#c77e18'
        },
        backdrop: {
            text: '#fffef8',
            background: '#188aa3'
        },
        divider: '#e6e2df',
        variant: 'classic',
        meta: {
            name: 'sacher'
        }
    },
    astro: {
        content: {
            text: '#aadff1',
            link: 'rgba(255, 255, 255, 0.8)',
            background: '#1c1e2d'
        },
        ui: {
            text: '#ffffff',
            background: '#92dda2'
        },
        backdrop: {
            text: '#dbfafc',
            background: '#1c1e2d'
        },
        divider: '#e6e2df',
        variant: 'classic',
        meta: {
            name: 'astro'
        }
    }
}
