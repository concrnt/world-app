import { Button, View, Divider, Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'
import { ThemeCard } from '../components/ThemeCard'
import { Themes } from '../data/themes'
import { usePreference, useResetPreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'

export const SettingsView = () => {
    const { logout } = useClient()

    const [_themeName, setThemeName] = usePreference('themeName')
    const reset = useResetPreference()

    return (
        <View>
            <Header>Settings</Header>
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
                <Text variant="h3">Theme</Text>
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
        </View>
    )
}
