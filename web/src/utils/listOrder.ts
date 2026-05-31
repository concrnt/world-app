// リストURIの並び順(listOrder)に従って items を並べ替える。
// order に含まれないもの(新規リスト等)は元の順序を保ったまま末尾に置く。
export const sortByListOrder = <T extends { uri: string }>(items: T[], order: string[]): T[] => {
    const rank = new Map(order.map((uri, index) => [uri, index]))
    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const rankA = rank.get(a.item.uri) ?? Number.POSITIVE_INFINITY
            const rankB = rank.get(b.item.uri) ?? Number.POSITIVE_INFINITY
            if (rankA !== rankB) return rankA - rankB
            return a.index - b.index
        })
        .map(({ item }) => item)
}
