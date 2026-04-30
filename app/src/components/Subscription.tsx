import { useClient } from '../contexts/Client'
import { Suspense } from 'react'
import { Checkbox, Text, List, ListItem } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useSubscribe } from '../hooks/useSubscribe'
import { PinnedListItemClass } from '@concrnt/worldlib'

export const Subscription = ({ target }: { target: string }) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4),
                width: '100%'
            }}
        >
            <Text variant="h3">リストに追加</Text>
            <Suspense fallback={<Text>Loading...</Text>}>
                <Lists target={target} />
            </Suspense>
        </div>
    )
}

const Lists = ({ target }: { target: string }) => {
    const { client } = useClient()
    const [pinnedLists] = useSubscribe(client.pinnedLists)

    return (
        <List>
            {pinnedLists.map((pin) => (
                <ListElem key={pin.uri} pin={pin} target={target} />
            ))}
        </List>
    )
}

const ListElem = ({ pin, target }: { pin: PinnedListItemClass; target: string }) => {
    const { client } = useClient()
    const [list] = useSubscribe(pin.list)
    const [items] = useSubscribe(list.items)
    const contains = items.includes(target) ?? false

    return (
        <ListItem
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(2),
                padding: `${CssVar.space(2)} 0`,
                borderBottom: `1px solid ${CssVar.divider}`
            }}
            secondaryAction={
                <Checkbox
                    checked={contains}
                    onChange={(checked) => {
                        if (!client) return
                        if (checked) {
                            // add
                            list.addItem(client, target)
                        } else {
                            // remove
                            list.removeItem(client, target)
                        }
                    }}
                />
            }
        >
            <Text>{list.title}</Text>
        </ListItem>
    )
}
