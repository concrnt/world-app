import type { ReactNode } from 'react'
import { Button, View, Divider, Text, List, ListItem } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'
import { ThemeCard } from '../components/ThemeCard'
import { Themes } from '../data/themes'
import { usePreference, useResetPreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { useStack } from '../layouts/Stack'
import { Activitypub } from './Activitypub'
import { IDView } from './ID'
import { DevView } from './Dev'
import { MdBadge, MdChevronRight, MdPalette, MdTerminal } from 'react-icons/md'
import { SiActivitypub } from 'react-icons/si'

const SettingsMenuItem = (props: { icon: ReactNode; children: ReactNode; onClick: () => void }) => (
    <ListItem icon={props.icon} secondaryAction={<MdChevronRight size={24} />} onClick={props.onClick}>
        {props.children}
    </ListItem>
)

export const SettingsView = () => {
    const { logout } = useClient()

    const reset = useResetPreference()
    const stack = useStack()

    return (
        <View>
            <Header>設定</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <Text variant="h3">設定</Text>
                <List
                    style={{
                        fontSize: '1.1rem'
                    }}
                >
                    <SettingsMenuItem icon={<MdPalette size={24} />} onClick={() => stack.push(<ThemeSettingsView />)}>
                        テーマ設定
                    </SettingsMenuItem>
                    <SettingsMenuItem icon={<SiActivitypub size={24} />} onClick={() => stack.push(<Activitypub />)}>
                        ActivityPub設定
                    </SettingsMenuItem>
                    <SettingsMenuItem icon={<MdBadge size={24} />} onClick={() => stack.push(<IDView />)}>
                        ID管理
                    </SettingsMenuItem>
                    <SettingsMenuItem icon={<MdTerminal size={24} />} onClick={() => stack.push(<DevView />)}>
                        開発者ツール
                    </SettingsMenuItem>
                </List>

                <Divider />

                <Text variant="h3">アカウント</Text>
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

export const ThemeSettingsView = () => {
    const [_themeName, setThemeName] = usePreference('themeName')

    return (
        <View>
            <Header>テーマ設定</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4),
                    padding: CssVar.space(4)
                }}
            >
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
            </div>
        </View>
    )
}
