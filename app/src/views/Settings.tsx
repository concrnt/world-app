import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'
import { Divider } from '../ui/Divider'
import { Text } from '../ui/Text'
import { ThemeCard } from '../components/ThemeCard'
import { Themes } from '../data/themes'
import { usePreference } from '../contexts/Preference'

export const SettingsView = () => {
    const { logout } = useClient()
    const { open } = useSidebar()

    const [_themeName, setThemeName] = usePreference('themeName')
    const [themeVariant, setThemeVariant] = usePreference('themeVariant')

    return (
        <View>
            <Header
                left={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        onClick={() => open()}
                    >
                        <MdMenu size={24} />
                    </div>
                }
            >
                Settings
            </Header>
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
                    <fieldset>
                        <legend>Variant</legend>
                        <label>
                            <input
                                type="radio"
                                name="theme-variant"
                                value="classic"
                                checked={themeVariant === 'classic'}
                                onChange={() => setThemeVariant('classic')}
                            />
                            Classic
                        </label>
                        <br />
                        <label>
                            <input
                                type="radio"
                                name="theme-variant"
                                value="modern"
                                checked={themeVariant === 'world'}
                                onChange={() => setThemeVariant('world')}
                            />
                            World
                        </label>
                    </fieldset>

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
    )
}
