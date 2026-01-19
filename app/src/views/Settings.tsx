import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { Divider } from '../ui/Divider'
import { Text } from '../ui/Text'
import { ThemeCard } from '../components/ThemeCard'
import { Themes } from '../data/themes'
import { usePreference } from '../contexts/Preference'
import { UnFab } from '../ui/UnFAB'

export const SettingsView = () => {
    const { logout } = useClient()

    const [_themeName, setThemeName] = usePreference('themeName')

    return (
        <>
            <View>
                <Header>Settings</Header>
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        overflowY: 'auto',
                        padding: '16px 0'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: '0 8px'
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

                        <Text variant="h3">Account</Text>
                        <Button
                            onClick={() => {
                                logout()
                            }}
                        >
                            Logout
                        </Button>
                    </div>
                </div>
            </View>
            <UnFab />
        </>
    )
}
