import { useEffect, useState } from 'react'
import { useClient } from '../contexts/Client'
import { View } from '../components/View'
import { ApNote } from './ApNote'
import { ApPerson } from './ApPerson'
import { ApObject, resolveApObject } from '../utils/activitypub'

interface Props {
    uri: string
}

export const ApView = (props: Props) => {
    const { client } = useClient()
    const [ld, setLd] = useState<ApObject>()

    useEffect(() => {
        resolveApObject(client, props.uri)
            .then((res) => {
                if (res) setLd(res)
            })
            .catch((err) => {
                console.log(err)
            })
    }, [props.uri, client])

    if (!ld) {
        return <View></View>
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
