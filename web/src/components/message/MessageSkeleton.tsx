import { CssVar, Skeleton } from '@concrnt/ui'
import { MessageLayout } from './MessageLayout'

// 実際の投稿(GfmMessage等)と同じ骨格: アバター48px / ユーザー名行 / 本文1行 / フッターのアクション列。
// 1行投稿(78px)と同じ高さになるようフッター行の高さで揃えている
export const MessageSkeleton = () => {
    return (
        <MessageLayout
            left={<Skeleton style={{ width: '48px', height: '48px', borderRadius: '4px' }} />}
            headerLeft={<Skeleton style={{ width: '6rem', height: '18px', borderRadius: CssVar.round(1) }} />}
            headerRight={<Skeleton style={{ width: '3rem', height: '12px', borderRadius: CssVar.round(1) }} />}
        >
            <Skeleton style={{ width: '60%', height: '18px', borderRadius: CssVar.round(1) }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(6), height: '34px' }}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                ))}
            </div>
        </MessageLayout>
    )
}
