import { useEffect, useState } from 'react'
import { useClient } from '../contexts/Client'
import { View } from '@concrnt/ui'
import { ApNote } from './ApNote'
import { ApPerson } from './ApPerson'
import { ApObject } from '../utils/activitypub'

interface Props {
    uri: string
}

export const ApView = (props: Props) => {
    const { client } = useClient()
    const [ld, setLd] = useState<ApObject>()

    useEffect(() => {
        client.api
            .fetchWithCredential<ApObject>(client.server.domain, `/ap/api/resolve?uri=${encodeURIComponent(props.uri)}`)
            .then(async (res) => setLd(new ApObject(res)))
    }, [props.uri, client])

    if (!ld) {
        return (
            <View>
                <p>Loading...</p>
            </View>
        )
    }

    switch (ld.type) {
        case 'Note':
            return <ApNote note={ld} />
        case 'Person':
            return <ApPerson person={ld} />
        default:
            return (
                <View>
                    <p>Unsupported type: {ld.type}</p>
                    <pre>{JSON.stringify(ld, null, 2)}</pre>
                </View>
            )
    }
}
