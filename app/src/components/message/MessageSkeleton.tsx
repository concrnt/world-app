import { CssVar, Skeleton } from '@concrnt/ui'
import { MessageLayout } from './MessageLayout'

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
            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(6), height: '34px' }}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                ))}
            </div>
        </MessageLayout>
    )
}
