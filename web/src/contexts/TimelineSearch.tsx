import { createContext, useContext, useMemo } from 'react'
import { useClient } from './Client'
import {
    CompositeSearchProvider,
    CrawlerSearchProvider,
    KnownCommunitySearchProvider,
    RecentSearchProvider,
    StaticSearchProvider,
    type SearchProvider
} from '../lib/timelineSearch'

// 投稿先候補の検索プロバイダー(最近使った + knownCommunities + crawler)をアプリ全体で共有する。
// 先頭に置いた recent がクエリ空の既定一覧の頭に並ぶ。
// ここではオブジェクトを作るだけで knownCommunities には触れないので、起動経路をサスペンドさせない
const TimelineSearchContext = createContext<SearchProvider>(new StaticSearchProvider([]))

export const TimelineSearchProvider = (props: { children: React.ReactNode }) => {
    const { client } = useClient()
    const provider = useMemo(
        () =>
            new CompositeSearchProvider([
                new RecentSearchProvider(),
                new KnownCommunitySearchProvider(client),
                new CrawlerSearchProvider(client)
            ]),
        [client]
    )
    return <TimelineSearchContext.Provider value={provider}>{props.children}</TimelineSearchContext.Provider>
}

export const useTimelineSearch = (): SearchProvider => useContext(TimelineSearchContext)
