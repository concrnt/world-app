import { useMemo, useState } from 'react'
import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { NotificationTimeline } from '../components/NotificationTimeline'
import { NotificationFilter } from '../components/NotificationFilter'
import { useClient } from '../contexts/Client'

export const NotificationsView = () => {
    const { client } = useClient()

    // フィルタで選択中のスキーマ URI。undefined のとき「全表示」
    const [selected, setSelected] = useState<string | undefined>(undefined)

    // query はサーバ側でのフィルタ用（現状では使わないため固定の空オブジェクト）。
    // 当初は query.schema でサーバ側フィルタをかける方針だったが、
    // 通知タイムラインの cckv items は実際には association への reference document
    // （schema: 'https://schema.concrnt.net/reference.json'）でラップされているため、
    // schema=likeAssociation のようなフィルタはサーバ側では実質機能しない
    // （reference document 自身の schema はいずれの Association schema とも一致しない）。
    // よって絞り込みはクライアント側で filterSchema によって in-memory で行う。
    // useMemo で参照を安定化しておかないと、レンダリングのたびに NotificationTimeline の
    // useEffect が再発火して reader が再初期化されてしまう。
    const query = useMemo(() => ({}), [])

    return (
        <View>
            <Header>Notifications</Header>
            <NotificationFilter selected={selected} setSelected={setSelected} />
            <NotificationTimeline
                prefix={`cckv://${client?.ccid}/concrnt.world/main/notify-timeline/`}
                query={query}
                filterSchema={selected}
            />
        </View>
    )
}
