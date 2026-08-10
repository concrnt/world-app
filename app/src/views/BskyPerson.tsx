import { Avatar, Button, CCWallpaper, CssVar, useTheme, View, Text } from '@concrnt/ui'
import { useNavigation } from '../contexts/Navigation'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { NotFoundError, Document } from '@concrnt/client'
import { Schemas, AtprotoFollowSchema } from '@concrnt/worldlib'
import { BskyProfile, bskyProfileUrl, followKey } from '../utils/bluesky'

interface Props {
    person: BskyProfile
}

export const BskyPerson = ({ person }: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.bskyPerson' })
    const theme = useTheme()
    const navigation = useNavigation()
    const { client } = useClient()

    const [followed, setFollowed] = useState<boolean | undefined>(undefined)

    const updateFollowed = () => {
        client.api
            .getDocument(followKey(client.ccid, person.did))
            .then(() => {
                setFollowed(true)
            })
            .catch((err) => {
                if (err instanceof NotFoundError) {
                    setFollowed(false)
                } else {
                    console.log(err)
                }
            })
    }

    useEffect(() => {
        updateFollowed()
    }, [person.did])

    return (
        <View>
            <div
                style={{
                    position: 'relative'
                }}
            >
                <CCWallpaper
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
                    ccid={person.did}
                    style={{
                        width: `100px`,
                        height: `100px`,
                        position: 'absolute',
                        transform: 'translateY(-50%)',
                        left: CssVar.space(2)
                    }}
                    src={person.avatar}
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
                        {followed !== undefined &&
                            (followed ? (
                                <Button
                                    onClick={() => {
                                        client.api
                                            .delete(followKey(client.ccid, person.did))
                                            .then(() => {
                                                setFollowed(false)
                                            })
                                            .catch((err) => {
                                                console.log(err)
                                            })
                                    }}
                                >
                                    {t('unfollow')}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => {
                                        const document: Document<AtprotoFollowSchema> = {
                                            kind: 'record',
                                            key: followKey(client.ccid, person.did),
                                            author: client.ccid,
                                            schema: Schemas.atprotoFollow,
                                            value: {
                                                did: person.did
                                            },
                                            createdAt: new Date()
                                        }
                                        client.api
                                            .commit(document)
                                            .then(() => {
                                                setFollowed(true)
                                            })
                                            .catch((err) => {
                                                console.log(err)
                                            })
                                    }}
                                >
                                    {t('follow')}
                                </Button>
                            ))}
                    </div>
                    <div>
                        <Text
                            variant="h6"
                            style={{
                                fontWeight: 'bold',
                                fontSize: '1.2rem'
                            }}
                        >
                            {person.displayName || person.handle}
                        </Text>
                        <Text>@{person.handle}</Text>
                    </div>
                    <div>
                        <Text>{person.description || t('noDescription')}</Text>
                    </div>
                </div>
            </div>
            <div>
                <Text>{t('bskyUserNotice')}</Text>
                <Button
                    onClick={() => {
                        openUrl(bskyProfileUrl(person.handle || person.did), 'inAppBrowser')
                    }}
                >
                    {t('openRemote')}
                </Button>
            </div>
        </View>
    )
}
