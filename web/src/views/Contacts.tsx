import { useClient } from '../contexts/Client'
import { AcknowledgeList } from '../components/AcknowledgeList'
import { View } from '../components/View'
import { Header } from '../components/Header'

export const ContactsView = () => {
    const { client } = useClient()

    return (
        <View>
            <Header>Contacts</Header>
            {client && <AcknowledgeList targetCcid={client.ccid} />}
        </View>
    )
}
