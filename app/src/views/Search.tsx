import { View } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'
import { Header } from '../ui/Header'
import { SearchExplorer } from '../components/SearchExplorer'

interface Props {
    // 持ち込む検索式(in:cckv://… 等)
    initialQuery?: string
}

// プロフィール/コミュニティ情報の検索ボタンから現在のスタックに積む検索画面。Explorerタブの検索状態には触らない
export const SearchView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.search' })
    return (
        <View>
            <Header>{t('title')}</Header>
            <SearchExplorer initialQuery={props.initialQuery} />
        </View>
    )
}
