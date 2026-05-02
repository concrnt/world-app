import { Avatar, Button, CCWallpaper, CssVar, useTheme, View, Text } from '@concrnt/ui'
import { Person } from '@fedify/vocab'
import { useNavigation } from '../contexts/Navigation'
import { openUrl } from '@tauri-apps/plugin-opener'

interface Props {
    person: Person
}

export const ApPerson = ({ person }: Props) => {
    const theme = useTheme()
    const navigation = useNavigation()

    console.log(person)

    person.getIcon().then((icon) => {
        console.log('icon', icon?.url?.href)
    })

    return (
        <View>
            <div
                style={{
                    position: 'relative'
                }}
            >
                <CCWallpaper
                    src={person.getImage().then((image) => image?.url?.href?.toString())}
                    style={{
                        paddingTop: theme.variant === 'classic' ? 'env(safe-area-inset-top)' : undefined,
                        height: '150px'
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: CssVar.space(1),
                            gap: CssVar.space(1)
                        }}
                    >
                        <div
                            style={{
                                color: theme.variant === 'classic' ? CssVar.backdropText : CssVar.uiText,
                                height: '40px',
                                width: '40px'
                            }}
                        >
                            {navigation.backNode}
                        </div>
                        <div style={{ flex: 1 }} />
                    </div>
                </CCWallpaper>
                <Avatar
                    ccid={person.id?.toString() ?? ''}
                    style={{
                        width: `100px`,
                        height: `100px`,
                        position: 'absolute',
                        transform: 'translateY(-50%)',
                        left: CssVar.space(2)
                    }}
                    src={person.getIcon().then((icon) => icon?.url?.href?.toString())}
                />
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2),
                        padding: `0 ${CssVar.space(2)}`
                    }}
                >
                    <div
                        style={{
                            minHeight: `50px`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end'
                        }}
                    >
                        <Button>フォロー</Button>
                    </div>
                    <div>
                        <Text
                            variant="h6"
                            style={{
                                fontWeight: 'bold',
                                fontSize: '1.2rem'
                            }}
                        >
                            {person.name || 'Anonymous'}
                        </Text>
                        <Text>
                            @{person.preferredUsername}@{person.id?.host ?? 'unknown'}
                        </Text>
                    </div>
                    <div>
                        <Text>{person.summary || '説明はまだありません'}</Text>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: CssVar.space(2)
                        }}
                    ></div>
                </div>
            </div>
            <div>
                <Text>このユーザーはActivityPubのユーザーです。</Text>
                {person.url && (
                    <Button
                        onClick={() => {
                            openUrl(person.url!.toString(), 'inAppBrowser')
                        }}
                    >
                        リモートで開く
                    </Button>
                )}
            </div>
        </View>
    )
}
