import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TabLayout } from '../layouts/Tab'
import { SidebarLayout } from '../layouts/Sidebar'
import { Sidebar } from '../components/Sidebar'

import { HomeView } from './Home'
import { ExplorerView } from './Explorer'
import { NotificationsView } from './Notifications'
import { ContactsView } from './Contacts'

import { MdHome } from 'react-icons/md'
import { MdExplore } from 'react-icons/md'
import { MdNotifications } from 'react-icons/md'
import { MdContacts } from 'react-icons/md'
import { StackLayout, StackLayoutRef } from '../layouts/Stack'
import { ScrollViewHandle } from '../types/ScrollView'
import { useTheme } from '../contexts/Theme'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { useToast } from '../contexts/Toast'
import { Schemas } from '@concrnt/worldlib'
import { TimelineReader, Document, ChunklineItem } from '@concrnt/client'
import { Avatar, CfmRenderer } from '@concrnt/ui'

export const MainView = () => {
    const [opened, setOpen] = useState(false)
    const { client } = useClient()
    const toast = useToast()

    // 新着通知バッジの状態
    const [hasNewNotification, setHasNewNotification] = useState(false)

    const stackRefs = useRef<Record<string, StackLayoutRef | null>>({})
    const scrollRefs = useRef<Record<string, ScrollViewHandle | null>>({})

    const theme = useTheme()

    // リアルタイム通知のセットアップ
    useEffect(() => {
        if (!client) return

        const notifyTimeline = `cckv://${client.ccid}/concrnt.world/main/notify-timeline`
        let reader: TimelineReader | undefined

        const handleNewItem = async (item: ChunklineItem) => {
            console.log('New notification item:', item)

            // 新着通知バッジを表示
            setHasNewNotification(true)

            // item.href からドキュメントを取得
            const message = await client.getMessage<any>(item.href).catch(() => null)
            if (!message) {
                console.log('Failed to get message:', item.href)
                return
            }

            console.log('Notification message:', message)

            const document = message
            if (!document) return

            // 自分自身からの通知は無視
            if (document.author === client.ccid) return

            // 作成者のプロフィールを取得
            const author = await client.getUser(document.author).catch(() => null)
            const username = author?.profile.username || 'anonymous'
            const avatar = author?.profile.avatar

            switch (document.schema) {
                case Schemas.replyAssociation: {
                    // リプライメッセージを取得
                    const replyMessageId = document.value?.messageId
                    if (replyMessageId) {
                        const replyMessage = await client.getMessage<any>(replyMessageId).catch(() => null)
                        toast.show(
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <Avatar ccid={document.author} src={avatar} style={{ width: '32px', height: '32px' }} />
                                <div>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                        {username} が返信しました
                                    </div>
                                    {replyMessage && (
                                        <div style={{ fontSize: '12px', opacity: 0.8 }}>
                                            <CfmRenderer messagebody={replyMessage.value.body} emojiDict={{}} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }
                    break
                }
                case Schemas.rerouteAssociation: {
                    toast.show(
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Avatar ccid={document.author} src={avatar} style={{ width: '32px', height: '32px' }} />
                            <div style={{ fontWeight: 'bold' }}>{username} がリルートしました</div>
                        </div>
                    )
                    break
                }
                case Schemas.likeAssociation: {
                    toast.show(
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Avatar ccid={document.author} src={avatar} style={{ width: '32px', height: '32px' }} />
                            <div style={{ fontWeight: 'bold' }}>{username} がお気に入りに登録しました</div>
                        </div>
                    )
                    break
                }
            }
        }

        // TimelineReader をセットアップ
        client.newTimelineReader().then((r) => {
            reader = r
            reader.onNewItem = handleNewItem
            reader.listen([notifyTimeline])
            console.log('Notification listener started for:', notifyTimeline)
        })

        // クリーンアップ
        return () => {
            if (reader) {
                reader.dispose()
            }
        }
    }, [client, toast])

    const tabs = useMemo(() => {
        return {
            home: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['home'] = el
                        }}
                    >
                        <HomeView
                            ref={(el) => {
                                scrollRefs.current['home'] = el
                            }}
                        />
                    </StackLayout>
                ),
                tab: <MdHome size={24} />
            },
            explorer: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['explorer'] = el
                        }}
                    >
                        <ExplorerView />
                    </StackLayout>
                ),
                tab: <MdExplore size={24} />
            },
            notifications: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['notifications'] = el
                        }}
                    >
                        <NotificationsView />
                    </StackLayout>
                ),
                tab: (
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <MdNotifications size={24} />
                        {hasNewNotification && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: -2,
                                    right: -2,
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: '#ff4444'
                                }}
                            />
                        )}
                    </div>
                )
            },
            contacts: {
                body: (
                    <StackLayout
                        ref={(el) => {
                            stackRefs.current['contacts'] = el
                        }}
                    >
                        <ContactsView />
                    </StackLayout>
                ),
                tab: <MdContacts size={24} />
            }
        }
    }, [hasNewNotification])

    const [selectedTab, setSelectedTab] = useState<string>('home')

    const selectTab = useCallback(
        (tab: string) => {
            if (tab === selectedTab) {
                if (!stackRefs.current[tab]?.clear()) {
                    scrollRefs.current[tab]?.scrollToTop()
                }
            }
            // 通知タブを選択したらバッジを消す
            if (tab === 'notifications') {
                setHasNewNotification(false)
            }
            setSelectedTab(tab)
        },
        [selectedTab]
    )

    return (
        <>
            <SidebarLayout
                opened={opened}
                setOpen={setOpen}
                content={
                    <Sidebar
                        onPush={(view) => {
                            console.log('pushing view to tab:', selectedTab)
                            const stackRef = stackRefs.current[selectedTab]
                            stackRef?.set(view)
                            setOpen(false)
                        }}
                    />
                }
            >
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: CssVar.backdropBackground
                    }}
                >
                    <TabLayout
                        selectedTab={selectedTab}
                        setSelectedTab={selectTab}
                        tabs={tabs}
                        style={{
                            paddingBottom: 'env(safe-area-inset-bottom)',
                            borderTop: theme.variant === 'classic' ? `1px solid ${CssVar.divider}` : undefined
                        }}
                        tabStyle={{
                            color: CssVar.backdropText
                        }}
                    />
                </div>
            </SidebarLayout>
        </>
    )
}
