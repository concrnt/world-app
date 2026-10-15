import { ReactNode, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CssVar, Text } from '@concrnt/ui'
import { ExternalLink } from '../ExternalLink'
import { bskyProfileUrl, type BskyFacet } from '../../utils/bluesky'

interface Props {
    text: string
    facets?: BskyFacet[]
}

// Bluesky投稿本文(app.bsky.feed.post.text)を facets(app.bsky.richtext.facet)に従ってリンク化して描く。
// facets の index は UTF-8 バイトオフセットなので、文字列を TextEncoder でバイト列にしてから切り出す。
// 表示文字列は短縮URL(example.com/...)で実URLは feature.uri に入っているのが普通なので、
// 本文の正規表現マッチではなく facets を正とする。facets が無ければ現状通りプレーンテキスト。
export const BskyRichText = (props: Props) => {
    const navigate = useNavigate()

    const segments = useMemo((): ReactNode[] => {
        if (!props.facets || props.facets.length === 0) return [props.text]

        // features が複数ある facet は最初に描けた1種類で出す。該当なしはプレーン
        const renderFacet = (facet: BskyFacet, label: string, key: number): ReactNode => {
            for (const feature of facet.features) {
                if (feature.$type === 'app.bsky.richtext.facet#link' && feature.uri) {
                    return (
                        <ExternalLink key={key} href={feature.uri} style={{ color: CssVar.contentLink }}>
                            {label}
                        </ExternalLink>
                    )
                }
                if (feature.$type === 'app.bsky.richtext.facet#mention' && feature.did) {
                    const did = feature.did
                    // アバタークリックと同じく Bluesky のユーザーページへ。右クリック用に実URLも持たせる
                    return (
                        <a
                            key={key}
                            href={bskyProfileUrl(did)}
                            style={{ color: CssVar.contentLink, textDecoration: 'none' }}
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                navigate('/bluesky/view/' + encodeURIComponent(did))
                            }}
                        >
                            {label}
                        </a>
                    )
                }
                if (feature.$type === 'app.bsky.richtext.facet#tag' && feature.tag) {
                    // アプリ内にハッシュタグ画面は無いので bsky.app の検索へ
                    return (
                        <ExternalLink
                            key={key}
                            href={'https://bsky.app/hashtag/' + encodeURIComponent(feature.tag)}
                            style={{ color: CssVar.contentLink }}
                        >
                            {label}
                        </ExternalLink>
                    )
                }
            }
            return label
        }

        const bytes = new TextEncoder().encode(props.text)
        const decoder = new TextDecoder()
        const sorted = [...props.facets].sort((a, b) => a.index.byteStart - b.index.byteStart)

        const out: ReactNode[] = []
        let cursor = 0
        for (const facet of sorted) {
            const { byteStart, byteEnd } = facet.index
            // 不正な facet(範囲外・逆転・前の区間と重なる)は飛ばしてプレーンのまま残す。本文全体を壊さない
            if (
                !Number.isInteger(byteStart) ||
                !Number.isInteger(byteEnd) ||
                byteStart < cursor ||
                byteStart >= byteEnd ||
                byteEnd > bytes.length
            ) {
                continue
            }
            if (byteStart > cursor) out.push(decoder.decode(bytes.subarray(cursor, byteStart)))
            const label = decoder.decode(bytes.subarray(byteStart, byteEnd))
            out.push(renderFacet(facet, label, out.length))
            cursor = byteEnd
        }
        if (cursor < bytes.length) out.push(decoder.decode(bytes.subarray(cursor)))
        return out
    }, [props.text, props.facets, navigate])

    return (
        <Text
            style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            }}
        >
            {segments}
        </Text>
    )
}
