import { Divider, IconButton, Text } from '@concrnt/ui'
import { MdContentCopy, MdDeleteForever } from 'react-icons/md'
import { ThemeCard } from '../components/ThemeCard'
import { ThemeEditor } from '../components/ThemeEditor'
import { usePreference } from '../contexts/Preference'
import { useThemeLibrary } from '../contexts/Theme'
import { Themes } from '../data/themes'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'

export const ThemeSettingsView = () => {
    const [themeName, setThemeName] = usePreference('themeName')
    const { customThemes, deleteTheme } = useThemeLibrary()
    const selectedTheme = customThemes[themeName] ?? Themes[themeName] ?? Themes.blue

    return (
        <View>
            <Header>テーマ設定</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4),
                    padding: CssVar.space(4)
                }}
            >
                <Text variant="h3">現在のテーマ: {selectedTheme.meta?.name ?? themeName}</Text>
                <ThemeCard theme={selectedTheme} />
                <Divider />

                <Text variant="h3">組み込みテーマ</Text>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: CssVar.space(3)
                    }}
                >
                    {Object.entries(Themes).map(([name, theme]) => (
                        <ThemeCard key={theme.meta?.name} theme={theme} onClick={() => setThemeName(name)} />
                    ))}
                </div>

                {Object.keys(customThemes).length > 0 && (
                    <>
                        <Divider />
                        <Text variant="h3">カスタムテーマ</Text>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                gap: CssVar.space(3)
                            }}
                        >
                            {Object.entries(customThemes).map(([name, theme]) => (
                                <div key={name} style={{ position: 'relative' }}>
                                    <ThemeCard theme={theme} onClick={() => setThemeName(name)} />
                                    <div
                                        style={{
                                            position: 'absolute',
                                            right: CssVar.space(1),
                                            top: CssVar.space(1),
                                            display: 'flex',
                                            gap: CssVar.space(0.5),
                                            backgroundColor: `rgb(from ${theme.content.background} r g b / 0.85)`,
                                            borderRadius: CssVar.round(4)
                                        }}
                                    >
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                navigator.clipboard?.writeText(JSON.stringify(theme))
                                            }}
                                        >
                                            <MdContentCopy size={18} />
                                        </IconButton>
                                        <IconButton
                                            onClick={async (e) => {
                                                e.stopPropagation()
                                                await deleteTheme(name)
                                                if (themeName === name) {
                                                    setThemeName('blue')
                                                }
                                            }}
                                        >
                                            <MdDeleteForever size={18} />
                                        </IconButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <Divider />
                <ThemeEditor key={themeName} baseName={themeName} baseTheme={selectedTheme} />
            </div>
        </View>
    )
}
