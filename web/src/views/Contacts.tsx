import { useClient } from '../contexts/Client'
import { AcknowledgeList } from '../components/AcknowledgeList'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'

export const ContactsView = () => {
    const { client, offlineDomain } = useClient()

    return (
        <View>
            <Header>Contacts</Header>
            {offlineDomain ? (
                <div
                    style={{
                        padding: CssVar.space(4),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(1)
                    }}
                >
                    <Text variant="h3">コンタクトを読み込めません</Text>
                    <Text style={{ opacity: 0.7 }}>
                        自分のドメインがオフラインのため、フォロー情報を取得できません。
                    </Text>
                </div>
            ) : (
                client && <AcknowledgeList targetCcid={client.ccid} />
            )}
        </View>
    )
}
