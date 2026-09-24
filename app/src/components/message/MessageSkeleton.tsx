import { CssVar, Skeleton } from '@concrnt/ui'
import { MessageLayout } from './MessageLayout'

// 実際の投稿(MarkdownMessage等)と同じ骨格: アバター40px / ユーザー名行 / 本文1行 / 投稿先チップ行 / アクション列。
// モバイル幅では投稿先チップがアクション列の上に折り返されるので、その1行投稿(98px)と同じ高さになるよう揃えている
export const MessageSkeleton = () => {
    return (
        <MessageLayout
            left={<Skeleton style={{ width: '40px', height: '40px', borderRadius: '4px' }} />}
            headerLeft={<Skeleton style={{ width: '6rem', height: '18px', borderRadius: CssVar.round(1) }} />}
            headerRight={<Skeleton style={{ width: '3rem', height: '12px', borderRadius: CssVar.round(1) }} />}
        >
            <Skeleton style={{ width: '60%', height: '18px', borderRadius: CssVar.round(1) }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', height: '16px', alignItems: 'center' }}>
                <Skeleton style={{ width: '7rem', height: '14px', borderRadius: CssVar.round(1) }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(6), height: '34px' }}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                ))}
            </div>
        </MessageLayout>
    )
}
