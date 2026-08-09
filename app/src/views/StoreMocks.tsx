import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Avatar,
    Button,
    CCWallpaper,
    CfmRenderer,
    IconButton,
    Passport,
    Tab,
    Tabs,
    Text,
    TextField,
    View
} from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import {
    MdAddReaction,
    MdAdd,
    MdArrowForward,
    MdBadge,
    MdCreate,
    MdMoreHoriz,
    MdPlaylistAdd,
    MdPublic,
    MdReply,
    MdRepeat,
    MdSearch,
    MdSecurity,
    MdStarOutline,
    MdTune
} from 'react-icons/md'
import { Header } from '../ui/Header'
import { FAB } from '../ui/FAB'
import { CssVar } from '../types/Theme'
import { MessageLayout } from '../components/message/MessageLayout'

type MockPost = {
    ccid: string
    username: string
    body: string
    timeline: string
    time: string
    replyCount: number
    rerouteCount: number
    likeCount: number
}

type MockTimeline = {
    title: string
    posts: MockPost[]
}

const mockTimelines: MockTimeline[] = [
    {
        title: 'ホーム',
        posts: [
            {
                ccid: 'solitudeSam',
                username: 'solitudeSam',
                body: 'この時間の静かさ、ほんとに好き。休日はひとりの時間が一番。',
                timeline: 'ホーム',
                time: '2分前',
                replyCount: 1,
                rerouteCount: 0,
                likeCount: 7
            },
            {
                ccid: 'geekyTom',
                username: 'geekyTom',
                body: '音楽といえば、最近アニソンが頭から離れない。聴くとなんかテンション上がる。',
                timeline: 'ホーム',
                time: '8分前',
                replyCount: 2,
                rerouteCount: 1,
                likeCount: 12
            },
            {
                ccid: 'cozyCara',
                username: 'cozyCara',
                body: '昼下がりの音楽セレクト、今日は何を聴こう。ちょっと悩むな。',
                timeline: 'ホーム',
                time: '14分前',
                replyCount: 0,
                rerouteCount: 0,
                likeCount: 5
            },
            {
                ccid: 'bookwormLiz',
                username: 'bookwormLiz',
                body: '新しい本が届いた！紅茶を淹れて読書の時間。最高の休日。',
                timeline: 'ホーム',
                time: '23分前',
                replyCount: 3,
                rerouteCount: 2,
                likeCount: 19
            },
            {
                ccid: 'geekyTom',
                username: 'geekyTom',
                body: '今日は久々に好きなアニメの再放送。これからまったり視聴タイム。',
                timeline: 'ホーム',
                time: '31分前',
                replyCount: 1,
                rerouteCount: 0,
                likeCount: 9
            }
        ]
    },
    {
        title: 'ゲーム界隈',
        posts: [
            {
                ccid: 'MechaMaster88',
                username: 'MechaMaster88',
                body: '「魔界の冒険者」のセーブデータ、消失…。泣きたい。',
                timeline: 'ゲーム界隈',
                time: '5分前',
                replyCount: 4,
                rerouteCount: 1,
                likeCount: 22
            },
            {
                ccid: 'CtrlAltDefeat_',
                username: 'CtrlAltDefeat_',
                body: 'VRゲームの新作、現実感がすごい！酔わないよう気をつけないと。',
                timeline: 'ゲーム界隈',
                time: '11分前',
                replyCount: 2,
                rerouteCount: 3,
                likeCount: 18
            },
            {
                ccid: 'GamerGalaxy_',
                username: 'GamerGalaxy_',
                body: '昨晩のオンラインバトル、完璧な連携だった。次も頼むぞ、チーム！',
                timeline: 'ゲーム界隈',
                time: '17分前',
                replyCount: 5,
                rerouteCount: 2,
                likeCount: 31
            },
            {
                ccid: 'retroReveler',
                username: 'retroReveler',
                body: '古いアーケードゲームを発見。コイン入れてプレイする感覚、懐かしい。',
                timeline: 'ゲーム界隈',
                time: '28分前',
                replyCount: 1,
                rerouteCount: 1,
                likeCount: 13
            },
            {
                ccid: 'bitBard',
                username: 'bitBard',
                body: 'ゲームのOST集めるのが趣味。今日は新しい1枚ゲット！',
                timeline: 'ゲーム界隈',
                time: '42分前',
                replyCount: 0,
                rerouteCount: 2,
                likeCount: 15
            }
        ]
    },
    {
        title: 'ごはん',
        posts: [
            {
                ccid: 'TofuTribe',
                username: 'TofuTribe',
                body: '手作りのビーガン料理に挑戦中。今日はトマトとキヌアのサラダ。',
                timeline: 'ごはん',
                time: '3分前',
                replyCount: 1,
                rerouteCount: 0,
                likeCount: 11
            },
            {
                ccid: 'SpiceSeeker_',
                username: 'SpiceSeeker_',
                body: '新しいスパイスショップを発見！エキゾチックな味で実験開始。',
                timeline: 'ごはん',
                time: '9分前',
                replyCount: 2,
                rerouteCount: 1,
                likeCount: 16
            },
            {
                ccid: 'NoodleNomad',
                username: 'NoodleNomad',
                body: '今日のラーメン、絶品だった。辛さがちょうど良い。',
                timeline: 'ごはん',
                time: '16分前',
                replyCount: 3,
                rerouteCount: 2,
                likeCount: 24
            },
            {
                ccid: 'BrewedLife',
                username: 'BrewedLife',
                body: '自家製のコールドブリュー、夏の定番。コーヒー豆の選び方が鍵。',
                timeline: 'ごはん',
                time: '26分前',
                replyCount: 0,
                rerouteCount: 0,
                likeCount: 8
            },
            {
                ccid: 'CrispyCritic_',
                username: 'CrispyCritic_',
                body: 'お店で食べた焼き鳥、外はサクサク、中はジューシー。次は友達を連れて行く！',
                timeline: 'ごはん',
                time: '39分前',
                replyCount: 2,
                rerouteCount: 1,
                likeCount: 20
            }
        ]
    }
]

const communities = [
    {
        id: 'games',
        cckv: 'cckv://concrnt.world/t/games',
        name: 'ゲーム界隈',
        description: '新作、レトロ、オンライン対戦まで。好きなゲームの話題が集まるコミュニティ。',
        sourceServer: 'concrnt.world'
    },
    {
        id: 'food',
        cckv: 'cckv://concrnt.world/t/food',
        name: 'ごはん',
        description: '今日の一皿、行ってよかったお店、家で作った料理をゆるく共有。',
        sourceServer: 'concrnt.world'
    },
    {
        id: 'music',
        cckv: 'cckv://concrnt.world/t/music',
        name: '音楽と日常',
        description: '作業用BGM、ライブの余韻、気分に合う曲を見つけたい人向け。',
        sourceServer: 'concrnt.world'
    },
    {
        id: 'books',
        cckv: 'cckv://concrnt.world/t/books',
        name: '読書メモ',
        description: '読んだ本、読みたい本、短い感想を集める落ち着いたコミュニティ。',
        sourceServer: 'concrnt.world'
    }
]

const users = [
    {
        id: 'cozyCara',
        ccid: 'cozyCara',
        username: 'cozyCara',
        description: '音楽と休日のログをゆるく残しています。',
        sourceServer: 'concrnt.world'
    },
    {
        id: 'GamerGalaxy_',
        ccid: 'GamerGalaxy_',
        username: 'GamerGalaxy_',
        description: '協力プレイとインディーゲームが好き。',
        sourceServer: 'concrnt.world'
    },
    {
        id: 'NoodleNomad',
        ccid: 'NoodleNomad',
        username: 'NoodleNomad',
        description: 'ラーメンと旅先のごはんを記録中。',
        sourceServer: 'concrnt.world'
    }
]

const avatarDataUri =
    'data:image/png;base64,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'

export const StoreMockHomeView = () => {
    const [selectedTab, setSelectedTab] = useState(0)
    const timeline = mockTimelines[selectedTab]

    return (
        <>
            <View>
                <Header
                    right={
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            <MdTune size={24} />
                        </div>
                    }
                >
                    Home
                </Header>
                <Tabs style={{ color: CssVar.contentLink }}>
                    {mockTimelines.map((tab, index) => (
                        <Tab
                            key={tab.title}
                            selected={selectedTab === index}
                            onClick={() => setSelectedTab(index)}
                            groupId="store-mock-home-tabs"
                            style={{
                                color: CssVar.contentText,
                                width: '120px'
                            }}
                        >
                            {tab.title}
                        </Tab>
                    ))}
                </Tabs>
                <MockTimeline posts={timeline.posts} />
            </View>
            <FAB>
                <MdAdd size={24} />
            </FAB>
        </>
    )
}

export const StoreMockExplorerView = () => {
    return (
        <>
            <View>
                <Header>Explorer</Header>
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2),
                        padding: CssVar.space(2),
                        paddingBottom: '7rem',
                        overflowY: 'auto',
                        touchAction: 'pan-y'
                    }}
                >
                    <MockSearchExplorer />
                </div>
            </View>
            <FAB>
                <MdCreate size={24} />
            </FAB>
        </>
    )
}

export const StoreMockIDView = () => {
    const { t } = useTranslation('', { keyPrefix: 'app.storeMocks' })
    return (
        <View>
            <Header>{t('idTitle')}</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2),
                    flex: 1,
                    overflowY: 'auto'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                    <Text variant="h3">Passport</Text>
                    <Text variant="caption">{t('passportDescription')}</Text>
                </div>

                <div>
                    <Tilt glareEnable={true} glareBorderRadius="5%">
                        <Passport
                            ccid="con1mockstorepassport"
                            name="Hikari"
                            avatar={avatarDataUri}
                            host="concrnt.world"
                            cdate="2026-05-31"
                        />
                    </Tilt>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: CssVar.space(2) }}>
                    <InfoTile icon={<MdBadge size={24} />} label="Current ID" value="@hikari" />
                    <InfoTile icon={<MdPublic size={24} />} label="Home Server" value="concrnt.world" />
                    <InfoTile icon={<MdSecurity size={24} />} label="Trust" value="Verified" />
                    <InfoTile icon={<MdSearch size={24} />} label="Discoverable" value="Enabled" />
                </div>

                <Button endIcon={<MdArrowForward size={20} />}>{t('openIdSettings')}</Button>
            </div>
        </View>
    )
}

const MockTimeline = ({ posts }: { posts: MockPost[] }) => {
    return (
        <div
            style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                gap: '8px',
                padding: '8px 0',
                overflowX: 'hidden',
                overflowY: 'auto',
                overscrollBehaviorY: 'none',
                touchAction: 'pan-y'
            }}
        >
            {posts.map((post) => (
                <MockTimelineCell key={`${post.timeline}-${post.ccid}-${post.time}`} post={post} />
            ))}
            <div
                style={{
                    padding: '8px',
                    fontSize: '12px',
                    color: '#888',
                    width: '100%',
                    height: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                -- End of Timeline --
            </div>
        </div>
    )
}

const MockTimelineCell = ({ post }: { post: MockPost }) => {
    return (
        <>
            <div
                style={{
                    padding: `0 ${CssVar.space(2)}`,
                    contentVisibility: 'auto'
                }}
            >
                <MessageLayout
                    left={<Avatar ccid={post.ccid} />}
                    headerLeft={<div style={{ fontWeight: 'bold' }}>{post.username}</div>}
                    headerRight={<Text variant="caption">{post.time}</Text>}
                >
                    <CfmRenderer messagebody={post.body} emojiDict={{}} />
                    <MockMessageFooter post={post} />
                </MessageLayout>
            </div>
            <div style={{ height: '1px', backgroundColor: CssVar.divider }} />
        </>
    )
}

const MockMessageFooter = ({ post }: { post: MockPost }) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'stretch',
                flexWrap: 'wrap',
                gap: CssVar.space(1)
            }}
        >
            <Text variant="caption">#{post.timeline}</Text>
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    marginLeft: `calc(${CssVar.space(2)} * -1)`
                }}
            >
                <FooterButton icon={<MdReply size={20} />} count={post.replyCount} />
                <FooterButton icon={<MdRepeat size={20} />} count={post.rerouteCount} />
                <FooterButton icon={<MdStarOutline size={20} />} count={post.likeCount} />
                <FooterButton icon={<MdAddReaction size={20} />} />
                <FooterButton icon={<MdMoreHoriz size={20} />} />
            </div>
        </div>
    )
}

const FooterButton = ({ icon, count }: { icon: ReactNode; count?: number }) => {
    return (
        <Button variant="text" style={{ display: 'flex', alignItems: 'center' }}>
            {icon}
            {!!count && <span style={{ marginLeft: '4px' }}>{count}</span>}
        </Button>
    )
}

const MockSearchExplorer = () => {
    const { t } = useTranslation('', { keyPrefix: 'app.storeMocks' })
    const [tab, setTab] = useState<'communities' | 'users'>('communities')
    const [query, setQuery] = useState('')

    const activeColor = CssVar.contentLink
    const inactiveColor = `rgb(from ${CssVar.contentText} r g b / 0.35)`
    const tabStyle = (selected: boolean) => ({
        color: selected ? activeColor : inactiveColor,
        fontWeight: selected ? ('bold' as const) : ('normal' as const)
    })

    const filteredCommunities = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        if (!normalized) return communities
        return communities.filter((community) => {
            return (
                community.name.toLowerCase().includes(normalized) ||
                community.description.toLowerCase().includes(normalized)
            )
        })
    }, [query])

    const filteredUsers = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        if (!normalized) return users
        return users.filter((user) => {
            return (
                user.username.toLowerCase().includes(normalized) || user.description.toLowerCase().includes(normalized)
            )
        })
    }, [query])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <Tabs>
                <Tab
                    selected={tab === 'communities'}
                    groupId="store-mock-search-explorer"
                    style={tabStyle(tab === 'communities')}
                    onClick={() => setTab('communities')}
                >
                    <Text>{t('communities')}</Text>
                </Tab>
                <Tab
                    selected={tab === 'users'}
                    groupId="store-mock-search-explorer"
                    style={tabStyle(tab === 'users')}
                    onClick={() => setTab('users')}
                >
                    <Text>{t('users')}</Text>
                </Tab>
            </Tabs>

            <TextField
                value={query}
                placeholder={tab === 'communities' ? t('searchCommunities') : t('searchUsers')}
                onChange={(e) => setQuery(e.target.value)}
            />

            {tab === 'communities' ? (
                filteredCommunities.length === 0 ? (
                    <Text variant="caption" style={{ opacity: 0.5 }}>
                        {t('noCommunitiesFound')}
                    </Text>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                        {filteredCommunities.map((community) => (
                            <MockCommunityCard key={community.id} community={community} />
                        ))}
                    </div>
                )
            ) : filteredUsers.length === 0 ? (
                <Text variant="caption" style={{ opacity: 0.5 }}>
                    {t('noUsersFound')}
                </Text>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
                    {filteredUsers.map((user) => (
                        <MockUserCard key={user.id} user={user} />
                    ))}
                </div>
            )}
        </div>
    )
}

const MockCommunityCard = ({ community }: { community: (typeof communities)[number] }) => {
    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                display: 'flex',
                overflow: 'hidden',
                height: '7rem',
                minHeight: '7rem',
                cursor: 'pointer'
            }}
        >
            <CCWallpaper style={{ height: '100%', aspectRatio: '1/1', flexShrink: 0 }} />
            <div
                style={{
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1,
                    minWidth: 0
                }}
            >
                <Text variant="h4" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {community.name}
                </Text>
                <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
                    {community.description}
                </Text>
                <Text
                    variant="caption"
                    style={{ opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {community.sourceServer}
                </Text>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton>
                        <MdPlaylistAdd size={24} />
                    </IconButton>
                </div>
            </div>
        </div>
    )
}

const MockUserCard = ({ user }: { user: (typeof users)[number] }) => {
    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer'
            }}
        >
            <CCWallpaper style={{ height: '60px', width: '100%' }} />
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2)
                }}
            >
                <Avatar
                    ccid={user.ccid}
                    style={{ width: '48px', height: '48px', borderRadius: '4px', flexShrink: 0 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
                    <Text variant="h4" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.username}
                    </Text>
                    <Text style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
                        {user.description}
                    </Text>
                    <Text variant="caption" style={{ opacity: 0.5 }}>
                        {user.sourceServer}
                    </Text>
                </div>
            </div>
        </div>
    )
}

const InfoTile = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => {
    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                padding: CssVar.space(2),
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(1),
                minWidth: 0
            }}
        >
            <div style={{ color: CssVar.contentLink }}>{icon}</div>
            <Text variant="caption">{label}</Text>
            <Text variant="h5" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
            </Text>
        </div>
    )
}
