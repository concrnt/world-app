import { Fragment, type ReactNode } from 'react'
import { OverlaySurface } from '../contexts/OverlayStack'
import { BottomSheet } from './BottomSheet'
import { List } from './List'
import { Text } from './Text'
import { CssVar } from '../types/Theme'

interface Props {
    open: boolean
    onClose: () => void
    title?: string
    // シートの高さを個数から見積もるため、childrenでなく配列で受ける
    options: ReactNode[]
}

export const Select = (props: Props) => {
    // 項目数から高さを見積もるが、画面の7割を上限にして中でスクロールさせる(候補が多いと画面外にはみ出て押せない)
    const height = Math.min(props.options.length * 56 + 30 + 48, Math.floor(window.innerHeight * 0.7))
    return (
        <OverlaySurface open={props.open} onClose={props.onClose}>
            <BottomSheet height={height} onDismiss={props.onClose}>
                {props.title && (
                    <div
                        style={{
                            height: '30px',
                            borderBottom: `1px solid ${CssVar.divider}`,
                            padding: `0 ${CssVar.space(2)}`
                        }}
                    >
                        <Text>{props.title}</Text>
                    </div>
                )}
                <List>
                    {props.options.map((opt, i) => (
                        <Fragment key={i}>{opt}</Fragment>
                    ))}
                </List>
            </BottomSheet>
        </OverlaySurface>
    )
}
