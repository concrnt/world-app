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

const fontScaleOptions: { key: FontScaleKey; label: string; description: string }[] = [
    { key: 'xs', label: '極小', description: '極小' },
    { key: 'sm', label: '小', description: '小' },
    { key: 'md', label: '標準', description: '標準（推奨）' },
    { key: 'lg', label: '大', description: '大' },
    { key: 'xl', label: '特大', description: '特大' },
    { key: 'xxl', label: '最大', description: '最大' }
]

const uiScaleOptions: { key: UIScaleKey; label: string; description: string }[] = [
    { key: 'xs', label: 'コンパクト', description: 'コンパクト（情報量重視）' },
    { key: 'sm', label: 'やや小', description: 'ややコンパクト' },
    { key: 'md', label: '標準', description: '標準（推奨）' },
    { key: 'lg', label: 'ゆとり', description: 'ゆとり（見やすさ重視）' },
    { key: 'xl', label: '広め', description: '広め（大きめUI）' }
]

export const SettingsView = () => {
    const { logout } = useClient()

    const [_themeName, setThemeName] = usePreference('themeName')
    const [fontScaleKey, setFontScaleKey] = usePreference('fontScaleKey')
    const [uiScaleKey, setUIScaleKey] = usePreference('uiScaleKey')
    const reset = useResetPreference()

    const currentFontDesc = fontScaleOptions.find((o) => o.key === fontScaleKey)?.description ?? '標準（推奨）'
    const currentUIDesc = uiScaleOptions.find((o) => o.key === uiScaleKey)?.description ?? '標準（推奨）'

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
                            gap: '12px'
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
                            <Text
                                style={{
                                    fontSize: 'var(--text-xs)',
                                    opacity: 0.7,
                                    marginTop: 'var(--space-1)'
                                }}
                            >
                                {currentFontDesc}
                            </Text>
                        </div>
                        <div>
                            <Text style={{ marginBottom: 'var(--space-1)' }}>UI密度</Text>
                            <ScaleSelector
                                options={uiScaleOptions}
                                value={uiScaleKey}
                                onChange={(v) => setUIScaleKey(v as UIScaleKey)}
                            />
                            <Text
                                style={{
                                    fontSize: 'var(--text-xs)',
                                    opacity: 0.7,
                                    marginTop: 'var(--space-1)'
                                }}
                            >
                                {currentUIDesc}
                            </Text>
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
