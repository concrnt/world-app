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
    const height = props.options.length * 56 + 30 + 48 // Approximate height calculation
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
                <List style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                    {props.options.map((opt, i) => (
                        <Fragment key={i}>{opt}</Fragment>
                    ))}
                </List>
            </BottomSheet>
        </OverlaySurface>
    )
}
