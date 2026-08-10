import { ReactNode } from 'react'
import styles from './Timestamp.module.css'

interface Props {
    onClick?: () => void
    children?: ReactNode
}

// app版との意図的な差分(web): 時刻表示をクリック可能にし、メッセージ詳細ビューへの遷移を担う。
// メッセージ本文のテキスト選択を妨げないため、全体クリックの代わりにこちらで遷移する。
export const Timestamp = (props: Props) => {
    return (
        <div
            className={styles.timestamp}
            onClick={(e) => {
                e.stopPropagation()
                props.onClick?.()
            }}
        >
            {props.children}
        </div>
    )
}
