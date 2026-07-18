import { Avatar, Button, CCWallpaper, CssVar, useTheme, Text } from '@concrnt/ui'
import { View } from '../components/View'
import { useNavigation } from '../contexts/Navigation'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { ApObject } from '../utils/activitypub'
import { useMediaProxy } from '../contexts/MediaProxy'

interface Props {
    person: ApObject
}

export const ApPerson = ({ person }: Props) => {
    const { getImageURL } = useMediaProxy()
    const { t } = useTranslation('', { keyPrefix: 'views.apPerson' })
    const theme = useTheme()
    const navigation = useNavigation()
    const { client } = useClient()

    console.log(person)

    const [followings, setFollowings] = useState<string[]>([])
    const followed = followings.includes(person.id?.toString() ?? '')

    const updateFollowings = () => {
        client.api
            .callConcrntApi<string[]>(client.server.domain, 'net.concrnt.activitypub.following', {})
            .then((response) => {
                setFollowings(response)
                console.log('followings', response)
            })
            .catch((err) => {
                console.log(err)
            })
    }

    useEffect(() => {
        updateFollowings()
    }, [])

    return (
        <View>
            <div
                style={{
                    position: 'relative'
                }}
            >
                <CCWallpaper
                    src={getImageURL(person.getImages()[0]?.url)}
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
                    src={person.getIcons()[0]?.url}
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
                        {followed ? (
                            <Button
                                onClick={() => {
                                    client.api
                                        .callConcrntApi(
                                            client.server.domain,
                                            'net.concrnt.activitypub.unfollow',
                                            {},
                                            {
                                                method: 'POST',
                                                body: JSON.stringify({
                                                    target: person.id?.toString()
                                                })
                                            }
                                        )
                                        .then((response) => {
                                            console.log('unfollow response', response)
                                            updateFollowings()
                                        })
                                }}
                            >
                                {t('unfollow')}
                            </Button>
                        ) : (
                            <Button
                                onClick={() => {
                                    client.api
                                        .callConcrntApi(
                                            client.server.domain,
                                            'net.concrnt.activitypub.follow',
                                            {},
                                            {
                                                method: 'POST',
                                                body: JSON.stringify({
                                                    target: person.id?.toString()
                                                })
                                            }
                                        )
                                        .then((response) => {
                                            console.log('follow response', response)
                                        })
                                }}
                            >
                                {t('follow')}
                            </Button>
                        )}
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
                            @{person.preferredUsername}@{new URL(person.id).host ?? 'unknown'}
                        </Text>
                    </div>
                    <div>
                        <Text>{person.summary || t('noDescription')}</Text>
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
                <Text>{t('apUserNotice')}</Text>
                {person.url && (
                    <Button
                        onClick={() => {
                            window.open(person.url!.toString(), '_blank', 'noopener,noreferrer')
                        }}
                    >
                        {t('openRemote')}
                    </Button>
                )}
            </div>
        </View>
    )
}
