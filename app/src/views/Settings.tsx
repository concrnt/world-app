import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { Divider } from '../ui/Divider'
import { Text } from '../ui/Text'
import { ThemeCard } from '../components/ThemeCard'
import { Themes } from '../data/themes'
import { usePreference, useResetPreference } from '../contexts/Preference'
import { ScaleSelector } from '../components/ScaleSelector'

import type { FontScaleKey, UIScaleKey } from '../contexts/Preference'

const fontScaleOptions = [
    { key: 'xs', label: '極小' },
    { key: 'sm', label: '小' },
    { key: 'md', label: '標準' },
    { key: 'lg', label: '大' },
    { key: 'xl', label: '特大' },
    { key: 'xxl', label: '最大' }
]

const uiScaleOptions = [
    { key: 'xs', label: 'コンパクト' },
    { key: 'sm', label: 'やや小' },
    { key: 'md', label: '標準' },
    { key: 'lg', label: 'ゆとり' },
    { key: 'xl', label: '広め' }
]

export const SettingsView = () => {
    const { logout } = useClient()

    const [_themeName, setThemeName] = usePreference('themeName')
    const [fontScaleKey, setFontScaleKey] = usePreference('fontScaleKey')
    const [uiScaleKey, setUIScaleKey] = usePreference('uiScaleKey')
    const reset = useResetPreference()

    return (
        <View>
            <Header>Settings</Header>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    overflowY: 'auto',
                    padding: 'var(--space-3) 0'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-2)',
                        padding: '0 var(--space-2)'
                    }}
                >
                    <Text variant="h3">Theme</Text>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: 'var(--space-3)'
                        }}
                    >
                        {Object.entries(Themes).map(([name, theme]) => (
                            <ThemeCard key={theme.meta?.name} theme={theme} onClick={() => setThemeName(name)} />
                        ))}
                    </div>

                    <Divider />

                    <Text variant="h3">Display</Text>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-3)'
                        }}
                    >
                        <div>
                            <Text style={{ marginBottom: 'var(--space-1)' }}>文字サイズ</Text>
                            <ScaleSelector
                                options={fontScaleOptions}
                                value={fontScaleKey}
                                onChange={(v) => setFontScaleKey(v as FontScaleKey)}
                            />
                        </div>
                        <div>
                            <Text style={{ marginBottom: 'var(--space-1)' }}>UI密度</Text>
                            <ScaleSelector
                                options={uiScaleOptions}
                                value={uiScaleKey}
                                onChange={(v) => setUIScaleKey(v as UIScaleKey)}
                            />
                        </div>
                    </div>

                    <Divider />

                    <Text variant="h3">Account</Text>
                    <Button
                        onClick={() => {
                            logout()
                            reset()
                        }}
                    >
                        Logout
                    </Button>
                </div>
            </div>
        </View>
    )
}
