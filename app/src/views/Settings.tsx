import { Button, View, Divider, Text, List, ListItem } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'
import { useResetPreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { useStack } from '../layouts/Stack'
import { Activitypub } from './Activitypub'
import { IDView } from './ID'
import { DevView } from './Dev'
import { EmojiSettingsView } from './EmojiSettings'
import { ThemeSettingsView } from './ThemeSettings'
import { MdBadge, MdChevronRight, MdEmojiEmotions, MdPalette, MdTerminal } from 'react-icons/md'
import { SiActivitypub } from 'react-icons/si'

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
                <List>
                    <ListItem
                        startIcon={<MdPalette size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<ThemeSettingsView />)}
                    >
                        テーマ設定
                    </ListItem>
                    <ListItem
                        startIcon={<SiActivitypub size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<Activitypub />)}
                    >
                        ActivityPub設定
                    </ListItem>
                    <ListItem
                        startIcon={<MdBadge size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<IDView />)}
                    >
                        ID管理
                    </ListItem>
                    <ListItem
                        startIcon={<MdEmojiEmotions size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<EmojiSettingsView />)}
                    >
                        絵文字
                    </ListItem>
                    <ListItem
                        startIcon={<MdTerminal size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<DevView />)}
                    >
                        開発者ツール
                    </ListItem>
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
