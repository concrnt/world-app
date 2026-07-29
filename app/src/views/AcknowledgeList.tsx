import { View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { AcknowledgeList } from '../components/AcknowledgeList'

// app専用のview。webはプロフィール画面のドロワーで表示する
interface Props {
    targetCcid: string
    initialTab?: 'acknowledging' | 'acknowledgers'
    title?: string
}

export const AcknowledgeListView = (props: Props) => {
    return (
        <View>
            <Header>{props.title}</Header>
            <AcknowledgeList targetCcid={props.targetCcid} initialTab={props.initialTab} />
        </View>
    )
}
