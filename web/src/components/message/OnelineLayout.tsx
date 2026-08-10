import { ReactNode } from 'react'

interface Props {
    left: ReactNode
    children?: ReactNode
    style?: React.CSSProperties
}

// app版との意図的な差分(web): テキストの部分選択コピーを妨げないよう全体クリックのonClickは
// 受け取らない。遷移は呼び出し側(OnelineMessage)が時刻クリックで行う。
export const OnelineMessageLayout = (props: Props) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                fontSize: '0.75rem',
                width: '100%',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                ...props.style
            }}
            onClick={(e) => {
                e.stopPropagation()
            }}
        >
            <div
                style={{
                    width: '48px',
                    flexShrink: 0
                }}
            >
                {props.left}
            </div>
            <div
                style={{
                    display: 'flex',
                    gap: '4px',
                    flex: 1,
                    opacity: 0.7,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {props.children}
            </div>
        </div>
    )
}
