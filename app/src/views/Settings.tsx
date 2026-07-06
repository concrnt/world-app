import { Button, View, Divider, Text, List, ListItem } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { getResourceCache } from '../lib/cache'
import { Header } from '../ui/Header'
import { usePreference, useResetPreference } from '../contexts/Preference'
import { CssVar } from '../types/Theme'
import { useStack } from '../layouts/Stack'
import { Activitypub } from './Activitypub'
import { IDView } from './ID'
import { DevView } from './Dev'
import { EmojiSettingsView } from './EmojiSettings'
import { ThemeSettingsView } from './ThemeSettings'
import { MdBadge, MdChevronRight, MdEmojiEmotions, MdPalette, MdTerminal } from 'react-icons/md'
import { SiActivitypub } from 'react-icons/si'
import { Fragment, useState } from 'react'
import buildTime from '~build/time'
import { branch, sha } from '~build/git'
import { version } from '~build/package'

const branchName = branch || window.location.host.split('.')[0]
const appInfoRows = [
    ['バージョン', version],
    ['ビルド日時', buildTime.toLocaleString()],
    ['ブランチ', branchName],
    ['コミット', sha]
]

export const SettingsView = () => {
    const { client, logout } = useClient()

    const reset = useResetPreference()
    const stack = useStack()
    const [developerMode, setDeveloperMode] = usePreference('developerMode')
    const [, setAppInfoTapCount] = useState(0)

    const handleAppInfoClick = () => {
        if (developerMode) return

        setAppInfoTapCount((count) => {
            const nextCount = count + 1
            if (nextCount >= 7) {
                setDeveloperMode(true)
                return 0
            }
            return nextCount
        })
    }

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
                    {developerMode && (
                        <ListItem
                            startIcon={<MdTerminal size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => stack.push(<DevView />)}
                        >
                            開発者ツール
                        </ListItem>
                    )}
                </List>

                <Divider />

                <Text variant="h3">アカウント</Text>
                <Button
                    onClick={async () => {
                        await getResourceCache(client.ccid).clear()
                        window.location.reload()
                    }}
                >
                    キャッシュを削除
                </Button>
                <Button
                    onClick={() => {
                        logout()
                        reset()
                    }}
                >
                    Logout
                </Button>

                <Divider />

                <div
                    onClick={handleAppInfoClick}
                    style={{
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: 8,
                        padding: CssVar.space(1.5),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(0.75),
                        opacity: 0.78,
                        userSelect: 'none'
                    }}
                >
                    <Text variant="caption" style={{ margin: 0, fontWeight: 700 }}>
                        アプリ情報
                    </Text>
                    <dl
                        style={{
                            margin: 0,
                            display: 'grid',
                            gridTemplateColumns: 'max-content minmax(0, 1fr)',
                            gap: `${CssVar.space(0.25)} ${CssVar.space(1)}`,
                            fontSize: '0.75rem',
                            lineHeight: 1.45
                        }}
                    >
                        {appInfoRows.map(([label, value]) => (
                            <Fragment key={label}>
                                <dt style={{ margin: 0 }}>{label}</dt>
                                <dd style={{ margin: 0, minWidth: 0, wordBreak: 'break-all' }}>{value}</dd>
                            </Fragment>
                        ))}
                    </dl>
                </div>
            </div>
        </View>
    )
}
