// crawler の投稿検索 q に書けるフィルター記法(author:<CCID> / in:<タイムラインcckv>)の解釈と組み立て。
// 規則は crawler 側 parsePostQuery と同じ: 空白区切り・最初のコロンで分割・キーは大小無視・値はそのまま・
// 空値や他のキーは本文扱い・同じ kind+value の重複は先頭優先で1つにする
export type SearchFilterKind = 'in' | 'author'

export interface SearchFilter {
    kind: SearchFilterKind
    value: string
}

export interface ParsedSearchQuery {
    filters: SearchFilter[]
    text: string
}

export const parseSearchQuery = (q: string): ParsedSearchQuery => {
    const filters: SearchFilter[] = []
    const words: string[] = []
    // JS の \s は U+3000(全角スペース)も含み、Go の strings.Fields と同じ区切りになる
    for (const token of q.split(/\s+/)) {
        if (token === '') continue
        const sep = token.indexOf(':')
        const key = sep > 0 ? token.slice(0, sep).toLowerCase() : ''
        const value = sep > 0 ? token.slice(sep + 1) : ''
        if ((key === 'in' || key === 'author') && value !== '') {
            if (!filters.some((f) => f.kind === key && f.value === value)) filters.push({ kind: key, value })
            continue
        }
        words.push(token)
    }
    return { filters, text: words.join(' ') }
}

// 決定的な文字列にする(フィルター→本文の順・単一スペース区切り)。useResource のキーにそのまま使える
export const composeSearchQuery = (filters: SearchFilter[], text: string): string => {
    const head = filters.map((f) => `${f.kind}:${f.value}`).join(' ')
    const body = text.trim()
    if (head === '') return body
    if (body === '') return head
    return `${head} ${body}`
}
