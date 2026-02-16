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
                            gap: 'var(--space-2)'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <Text>文字サイズ</Text>
                            <ScaleSelector
                                options={['xs', 'sm', 'md', 'lg', 'xl', 'xxl']}
                                value={fontScaleKey}
                                onChange={(v) => setFontScaleKey(v as FontScaleKey)}
                            />
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <Text>UI密度</Text>
                            <ScaleSelector
                                options={['xs', 'sm', 'md', 'lg', 'xl']}
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
