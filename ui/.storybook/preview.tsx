import type { Preview } from '@storybook/react-vite'
import type { Theme } from '../src/types/Theme'

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
        space: '4px',
        round: '8px',
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
        space: '4px',
        round: '8px',
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
        space: '4px',
        round: '8px',
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
        space: '4px',
        round: '8px',
        variant: 'world',
        meta: {
            name: 'rainyday'
        }
    }
}

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i
            }
        },

        a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: 'todo'
        }
    },
    globalTypes: {
        theme: {
            description: 'Global theme for components',
            defaultValue: 'All',
            toolbar: {
                title: 'Theme',
                icon: 'circlehollow',
                dynamicTitle: true,
                items: ['All', ...Object.keys(Themes)]
            }
        }
    },
    decorators: [
        (Story, context) => {
            const themeName = context.globals.theme || 'All'
            let previewTargets: Theme[] = []
            if (themeName === 'All') {
                previewTargets = Object.values(Themes)
            } else {
                previewTargets.push(Themes[themeName])
            }

            return (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {previewTargets.map((themeData) => (
                        <div
                            key={themeData.meta.name}
                            style={{
                                display: 'flex',
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'var(--content-background)',
                                '--content-text': themeData.content.text,
                                '--content-link': themeData.content.link,
                                '--content-background': themeData.content.background,
                                '--ui-text': themeData.ui.text,
                                '--ui-background': themeData.ui.background,
                                '--backdrop-text': themeData.backdrop.text,
                                '--backdrop-background': themeData.backdrop.background,
                                '--divider': themeData.divider,
                                '--space': themeData.space,
                                '--round': themeData.round
                            }}
                        >
                            <Story />
                        </div>
                    ))}
                </div>
            )
        }
    ]
}

export default preview
