import { Button, Divider, Text, List, ListItem } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { useResetPreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { Header } from '../components/Header'
import { View } from '../components/View'
import { useNavigate } from 'react-router-dom'
import { MdBadge, MdChevronRight, MdEmojiEmotions, MdPalette, MdTerminal } from 'react-icons/md'
import { SiActivitypub } from 'react-icons/si'

export const SettingsView = () => {
    const { logout } = useClient()

    const reset = useResetPreference()
    const navigate = useNavigate()

    return (
        <View>
            <Header>設定</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
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
                        onClick={() => navigate('/settings/theme')}
                    >
                        テーマ設定
                    </ListItem>
                    <ListItem
                        startIcon={<SiActivitypub size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/activitypub')}
                    >
                        ActivityPub設定
                    </ListItem>
                    <ListItem
                        startIcon={<MdBadge size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/id')}
                    >
                        ID管理
                    </ListItem>
                    <ListItem
                        startIcon={<MdEmojiEmotions size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/emoji')}
                    >
                        絵文字
                    </ListItem>
                    <ListItem
                        startIcon={<MdTerminal size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => navigate('/settings/dev')}
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
