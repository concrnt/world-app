import { Button, CssVar, Divider, Text, View } from '@concrnt/ui'
import { ThemeCard } from '../components/ThemeCard'
import { useClient } from '../contexts/Client'
import { usePreference, useResetPreference } from '../contexts/Preference'
import { Themes } from '../data/themes'
import { Header } from '../ui/Header'

export const Settings = () => {
    const { client, logout } = useClient()
    const [themeName, setThemeName] = usePreference('themeName')
    const resetPreference = useResetPreference()

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header>Settings</Header>
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4),
                    padding: CssVar.space(4)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    <Text variant="h2">Account</Text>
                    <Text>{client?.ccid}</Text>
                    <Text>{client?.server.domain}</Text>
                </div>

                <Divider />

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(3)
                    }}
                >
                    <Text variant="h2">Theme</Text>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: CssVar.space(3)
                        }}
                    >
                        {Object.entries(Themes).map(([name, theme]) => (
                            <ThemeCard
                                key={name}
                                theme={theme}
                                selected={themeName === name}
                                onClick={() => setThemeName(name)}
                            />
                        ))}
                    </div>
                </div>

                <Divider />

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    <Text variant="h2">Session</Text>
                    <Button
                        onClick={() => {
                            resetPreference()
                            void logout()
                        }}
                    >
                        ログアウト
                    </Button>
                </div>
            </div>
        </View>
    )
}
