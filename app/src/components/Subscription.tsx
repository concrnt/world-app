import { Document } from '@concrnt/client'
import { ListSchema, Schemas } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { useCallback, useEffect, useState } from 'react'
import { Checkbox } from '../ui/Checkbox'
import { Text } from '../ui/Text'

export const Subscription = ({ target }: { target: string }) => {
    const { client } = useClient()

    const [lists, setLists] = useState<Record<string, Document<ListSchema>>>({})

    const fetchLists = useCallback(() => {
        if (!client) return
        client.api
            .query({
                prefix: `cckv://${client.ccid}/concrnt.world/`,
                schema: Schemas.list
            })
            .then((results) => {
                const mapped: Record<string, Document<ListSchema>> = {}
                results.forEach((sd) => {
                    mapped[sd.cckv] = JSON.parse(sd.document)
                })
                setLists(mapped)
                console.log('Fetched communities:', results)
            })
            .catch((error) => {
                console.error('Error fetching communities:', error)
            })
    }, [client])

    useEffect(() => {
        fetchLists()
    }, [fetchLists])

    return (
        <div>
            {Object.entries(lists).map(([uri, list]) => (
                <ListItem key={uri} list={list} target={target} reload={fetchLists} />
            ))}
        </div>
    )
}

const ListItem = ({ list, target, reload }: { list: Document<ListSchema>; target: string; reload: () => void }) => {
    const { client } = useClient()
    const contains = list.value.items?.includes(target) ?? false

    return (
        <div
            style={{
                padding: '8px',
                borderBottom: '1px solid #ccc'
            }}
        >
            <Text>{list.value.title}</Text>
            <Checkbox
                checked={contains}
                onChange={(checked) => {
                    const newList = { ...list }
                    if (checked) {
                        // add
                        newList.value.items = newList.value.items ?? []
                        if (!newList.value.items.includes(target)) {
                            newList.value.items.push(target)
                        }
                    } else {
                        // remove
                        newList.value.items = newList.value.items?.filter((item) => item !== target)
                    }
                    // commit changes
                    client?.api.commit(newList).then(() => {
                        console.log('List updated')
                        reload()
                    })
                }}
            />
        </div>
    )
}
