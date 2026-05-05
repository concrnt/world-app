import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useClient } from '../contexts/Client'
import { AcknowledgeList } from '../components/AcknowledgeList'

export const ContactsView = () => {
    const { client } = useClient()

    return (
        <View>
            <Header>Contacts</Header>
            {client && <AcknowledgeList targetCcid={client.ccid} />}
        </View>
    )
}
