import { CssVar, Skeleton } from '@concrnt/ui'
import { MessageLayout } from './MessageLayout'

// 実際の投稿(MarkdownMessage等)と同じ骨格: アバター40px / ユーザー名行 / 本文1行 / 投稿先チップ行 / アクション列。
// モバイル幅では投稿先チップがアクション列の上に折り返されるので、その1行投稿(98px)と同じ高さになるよう揃えている
//
// テキスト行は行ボックス(18px)ではなく文字が見える範囲(上5px空けて12px)だけを塗る。
// アバターはmarginTop 5pxで文字の上端と視覚的に揃えてあるので、skeletonでも同じ位置に上端が来る
const TextLine = (props: { width: string; height?: string }) => (
    <div style={{ height: '18px', paddingTop: '5px' }}>
        <Skeleton style={{ width: props.width, height: props.height ?? '12px', borderRadius: CssVar.round(1) }} />
    </div>
)

export const MessageSkeleton = () => {
    return (
        <MessageLayout
            left={<Skeleton style={{ width: '40px', height: '40px', borderRadius: '4px' }} />}
            headerLeft={<TextLine width="6rem" />}
            headerRight={<TextLine width="3rem" height="10px" />}
        >
            <TextLine width="60%" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', height: '16px', alignItems: 'center' }}>
                <Skeleton style={{ width: '7rem', height: '10px', borderRadius: CssVar.round(1) }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(6), height: '34px' }}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                ))}
            </div>
        </MessageLayout>
    )
}
