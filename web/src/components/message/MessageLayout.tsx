import { ReactNode } from 'react'
import { Timestamp } from './Timestamp'

interface Props {
    onClick?: () => void
    detail?: boolean
    left: ReactNode
    headerLeft: ReactNode
    headerRight?: ReactNode
    children?: ReactNode
}

// app版との意図的な差分(web): テキストの部分選択コピーを妨げないよう、メッセージ全体クリックでは
// 遷移せず、headerRight(時刻)のクリックで詳細ビューへ遷移する。
// headerRightが無いカード型の利用(FollowAck / RerouteAssociation等)は従来どおり全体クリック。
export const MessageLayout = (props: Props) => {
    const timestampNav = !props.detail && props.onClick !== undefined && Boolean(props.headerRight)
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                overflow: 'hidden',
                userSelect: 'text',
                WebkitUserSelect: 'text'
            }}
            onClick={(e) => {
                e.stopPropagation()
                if (!props.detail && !timestampNav) props.onClick?.()
            }}
        >
            <div style={{ flexShrink: 0, marginTop: '5px' }}>{props.left}</div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1,
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                    }}
                >
                    {props.headerLeft}
                    {timestampNav ? (
                        <Timestamp onClick={props.onClick}>{props.headerRight}</Timestamp>
                    ) : (
                        props.headerRight
                    )}
                </div>
                {props.children}
            </div>
        </div>
    )
}
