import { View } from '@concrnt/ui'
import { useParams, useSearchParams } from 'react-router-dom'
import { AcknowledgeList } from '../components/AcknowledgeList'
import { useClient } from '../contexts/Client'
import { Header } from '../ui/Header'

export const Contacts = () => {
    const { client } = useClient()
    const { ccid } = useParams()
    const [searchParams] = useSearchParams()

    if (!client) return null

    const targetCcid = ccid ? decodeURIComponent(ccid) : client.ccid
    const initialTab = searchParams.get('tab') === 'acknowledgers' ? 'acknowledgers' : 'acknowledging'

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header>Contacts</Header>
            <AcknowledgeList targetCcid={targetCcid} initialTab={initialTab} />
        </View>
    )
}
