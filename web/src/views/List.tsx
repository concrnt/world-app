import { Divider, Text } from '@concrnt/ui'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { ScrollViewHandle, ScrollViewRef } from '../types/ScrollView'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { Composer } from '../components/Composer'
import { List, semantics } from '@concrnt/worldlib'
import { MdCreate, MdTune } from 'react-icons/md'
import { Drawer } from '../components/Drawer'
import { ListSettings } from '../components/ListSettings'
import { FAB } from '../components/FAB'
import { useComposer } from '../contexts/Composer'
import { useIsMobile } from '../hooks/useIsMobile'
import { hapticLight } from '../utils/haptics'
import { useSubscribe } from '../hooks/useSubscribe'
import { useTranslation } from 'react-i18next'

interface Props {
    uri: string
}

export const ListView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.list' })
    const { client } = useClient()
    const [settingsOpen, setSettingsOpen] = useState(false)
    const composer = useComposer()
    const isMobile = useIsMobile()

    const scrollRef = useRef<ScrollViewHandle>(null)

    // uriとセットで保持し、uriが変わった直後に古いリストを見せないようにする
    const [fetched, setFetched] = useState<{ uri: string; list: List | null }>()
    // リスト設定での編集(リネーム・削除)を再フェッチで反映する
    const [updater, setUpdater] = useState(0)
    useEffect(() => {
        if (!client) return
        let cancelled = false
        client
            .getList(props.uri)
            .then((l) => {
                if (!cancelled) setFetched({ uri: props.uri, list: l })
            })
            .catch(() => {
                if (!cancelled) setFetched({ uri: props.uri, list: null })
            })
        return () => {
            cancelled = true
        }
    }, [client, props.uri, updater])

    // undefined: ロード中 / null: 取得失敗
    const list = fetched?.uri === props.uri ? fetched.list : undefined

    // excludeSelfやデフォルト投稿先はピンの設定。未ピンのリストには存在しない(=自分を含める)
    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const pin = pinnedLists.find((p) => p.uri === props.uri)

    const [knownCommunities] = useSubscribe(client.knownCommunities)

    // インラインエディタの投稿先。リストのデフォルトを初期値にしつつ、その場で編集できるようにする
    const defaultDestinations = pin?.defaultPostTimelines ?? []
    const [destinations, setDestinations] = useState<string[]>(defaultDestinations)
    // リスト切替やピン設定のロードでデフォルト投稿先が変わったら追従する(レンダー中の状態調整)
    const defaultsKey = props.uri + '|' + defaultDestinations.join(',')
    const [prevDefaultsKey, setPrevDefaultsKey] = useState(defaultsKey)
    if (prevDefaultsKey !== defaultsKey) {
        setPrevDefaultsKey(defaultsKey)
        setDestinations(defaultDestinations)
    }

    return (
        <>
            <View>
                <Header
                    onTitleTap={() => scrollRef.current?.scrollToTop()}
                    right={
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                            onClick={() => setSettingsOpen(true)}
                        >
                            <MdTune size={24} />
                        </div>
                    }
                >
                    {list?.title}
                </Header>
                {list === null ? (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            padding: CssVar.space(4)
                        }}
                    >
                        <Text>{t('listNotFound')}</Text>
                    </div>
                ) : (
                    list && (
                        <ListTimeline
                            ref={scrollRef}
                            list={list}
                            excludeSelf={pin?.excludeSelf}
                            headElement={
                                // モバイルではインラインエディタは出さず、FABからモーダルで投稿する(app版と同じ体験)
                                isMobile ? undefined : (
                                    <>
                                        <div style={{ padding: CssVar.space(2) }}>
                                            <Composer
                                                mode="normal"
                                                autoGrow
                                                destinations={destinations}
                                                setDestinations={setDestinations}
                                                defaultDestinations={defaultDestinations}
                                                options={knownCommunities}
                                                initialProfile={pin?.defaultProfile}
                                            />
                                        </div>
                                        <Divider />
                                    </>
                                )
                            }
                        />
                    )
                )}
            </View>
            <FAB
                onClick={() => {
                    hapticLight()
                    composer.open(pin?.defaultPostTimelines ?? [], undefined, undefined, undefined, pin?.defaultProfile)
                }}
            >
                <MdCreate size={24} />
            </FAB>
            <Drawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <ListSettings
                    uri={props.uri}
                    onComplete={() => {
                        setSettingsOpen(false)
                        setUpdater((u) => u + 1)
                    }}
                />
            </Drawer>
        </>
    )
}

const ListTimeline = (props: { list: List; excludeSelf?: boolean; ref?: ScrollViewRef; headElement?: ReactNode }) => {
    const { client } = useClient()

    const [items] = useSubscribe(props.list.items)

    const self = semantics.homeTimeline(client.ccid, client.currentProfile)
    const timelines = useMemo(
        () => [...new Set([...(props.excludeSelf ? [] : [self]), ...items])],
        [self, items, props.excludeSelf]
    )

    return <RealtimeTimeline ref={props.ref} timelines={timelines} headElement={props.headElement} />
}
