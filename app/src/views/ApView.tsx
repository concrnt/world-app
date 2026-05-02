import { useEffect, useState } from 'react'
import { Object as ApObject, Note, Person, getTypeId } from '@fedify/vocab'
import { useClient } from '../contexts/Client'
import { View } from '@concrnt/ui'
import { ApNote } from './ApNote'
import { ApPerson } from './ApPerson'

interface Props {
    uri: string
}

export const ApView = (props: Props) => {
    const { client } = useClient()
    const [ld, setLd] = useState<ApObject>()

    useEffect(() => {
        client.api
            .fetchWithCredential<ApObject>(client.server.domain, `/ap/api/resolve?uri=${encodeURIComponent(props.uri)}`)
            .then(async (res) => setLd(await ApObject.fromJsonLd(res)))
    }, [props.uri, client])

    if (!ld) {
        return (
            <View>
                <p>Loading...</p>
            </View>
        )
    }

    switch (getTypeId(ld).toString()) {
        case Note.typeId.toString():
            return <ApNote note={ld as Note} />
        case Person.typeId.toString():
            return <ApPerson person={ld as Person} />
        default:
            return (
                <View>
                    <p>Unsupported type: {getTypeId(ld).toString()}</p>
                    <p>Supported types:</p>
                    <p>{Note.typeId.toString()}</p>
                    <p>{Person.typeId.toString()}</p>
                </View>
            )
    }
}
