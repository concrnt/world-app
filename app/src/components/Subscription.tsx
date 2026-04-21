import { List } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { Suspense, use, useMemo, useState } from 'react'
import { Checkbox, Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'

export const Subscription = ({ target }: { target: string }) => {
    const { client } = useClient()

    const [updater, setUpdater] = useState(0)
    const listsPromise = useMemo(() => {
        if (!client) return Promise.resolve([])
        return client.getLists()
    }, [client, updater])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4)
            }}
        >
            <Text variant="h3">リストに追加</Text>
            <Suspense fallback={<Text>Loading...</Text>}>
                <Lists listsPromise={listsPromise} target={target} reload={() => setUpdater((u) => u + 1)} />
            </Suspense>
        </div>
    )
}

const Lists = ({
    listsPromise,
    target,
    reload
}: {
    listsPromise: Promise<List[]>
    target: string
    reload: () => void
}) => {
    const lists = use(listsPromise)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            {lists.map((list) => (
                <ListItem key={list.uri} list={list} target={target} reload={reload} />
            ))}
        </div>
    )
}

const ListItem = ({ list, target, reload }: { list: List; target: string; reload: () => void }) => {
    const { client } = useClient()
    const contains = list.items?.includes(target) ?? false

    console.log('ListItem', { list, target, contains })

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(2),
                padding: `${CssVar.space(2)} 0`,
                borderBottom: `1px solid ${CssVar.divider}`
            }}
        >
            <Checkbox
                checked={contains}
                onChange={(checked) => {
                    if (!client) return
                    if (checked) {
                        // add
                        list.addItem(client, target).then(() => {
                            reload()
                        })
                    } else {
                        // remove
                        list.removeItem(client, target).then(() => {
                            reload()
                        })
                    }
                }}
            />
            <Text>{list.title}</Text>
        </div>
    )
}
