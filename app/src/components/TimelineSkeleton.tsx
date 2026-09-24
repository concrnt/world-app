import { Fragment, ReactNode } from 'react'
import { CssVar, Divider } from '@concrnt/ui'
import { MessageSkeleton } from './message/MessageSkeleton'

interface Props {
    // RealtimeTimelineのheadElementに相当する先頭要素(web版のインラインComposer等)
    headElement?: ReactNode
}

// RealtimeTimelineがマウントされる前(タブ切替中など)のフォールバック。
// RealtimeTimelineのスクロールコンテナ(padding: 8px 0 / gap: 8px / セルの左右padding / Divider)と
// 同じ構造で組み、実際のタイムラインに置き換わったときにレイアウトシフトが起きないようにする
export const TimelineSkeleton = (props: Props) => {
    return (
        <div
            style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '8px 0',
                    overflow: 'hidden',
                    // RealtimeTimelineのスクロールコンテナと同じくガターを確保し、置き換わっても内容幅が変わらないようにする
                    scrollbarGutter: 'stable'
                }}
            >
                {props.headElement}
                {Array.from({ length: 10 }).map((_, i) => (
                    <Fragment key={i}>
                        <div style={{ padding: `0 ${CssVar.space(2)}` }}>
                            <MessageSkeleton />
                        </div>
                        <Divider />
                    </Fragment>
                ))}
            </div>
        </div>
    )
}
