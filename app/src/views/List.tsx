import { View, Text } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useClient } from '../contexts/Client'
import { RealtimeTimeline } from '../components/RealtimeTimeline'
import { FAB } from '../ui/FAB'
import { useComposer } from '../contexts/Composer'
import { MdCreate, MdTune } from 'react-icons/md'
import { hapticLight } from '../utils/haptics'
import { ScrollViewHandle, ScrollViewRef } from '../types/ScrollView'
import { Drawer } from '../ui/Drawer'
import { ListSettings } from '../components/ListSettings'
import { List, semantics } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { useSubscribe } from '../hooks/useSubscribe'
import { useTranslation } from 'react-i18next'

interface Props {
    uri: string
}

export const ListView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.list' })
    const { client } = useClient()
    const composer = useComposer()
    const [settingsOpen, setSettingsOpen] = useState(false)

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
                    list && <ListTimeline ref={scrollRef} list={list} excludeSelf={pin?.excludeSelf} />
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

const ListTimeline = (props: { list: List; excludeSelf?: boolean; ref?: ScrollViewRef }) => {
    const { client } = useClient()

    const [items] = useSubscribe(props.list.items)

    const self = semantics.homeTimeline(client.ccid, client.currentProfile)
    const timelines = useMemo(
        () => [...new Set([...(props.excludeSelf ? [] : [self]), ...items])],
        [self, items, props.excludeSelf]
    )

    return <RealtimeTimeline ref={props.ref} timelines={timelines} />
}
