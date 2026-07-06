import { Fragment, type ReactNode, useCallback, useMemo } from 'react'
import { useOverlayStack } from './OverlayStack'
import { BottomSheet } from '../ui/BottomSheet'
import { List } from '../ui/List'
import { Text } from '../ui/Text'
import { CssVar } from '../types/Theme'

interface SelectState {
    select: (title: string, options: ReactNode[]) => void
    close: () => void
}

export const useSelect = (): SelectState => {
    const stack = useOverlayStack()

    const select = useCallback(
        (title: string, options: ReactNode[]) => {
            const height = options.length * 56 + 30 + 48 // Approximate height calculation
            stack.push({
                kind: 'select',
                render: (close) => (
                    <BottomSheet height={height} onDismiss={close}>
                        {title && (
                            <div
                                style={{
                                    height: '30px',
                                    borderBottom: `1px solid ${CssVar.divider}`,
                                    padding: `0 ${CssVar.space(2)}`
                                }}
                            >
                                <Text>{title}</Text>
                            </div>
                        )}
                        <List style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                            {options.map((opt, i) => (
                                <Fragment key={i}>{opt}</Fragment>
                            ))}
                        </List>
                    </BottomSheet>
                )
            })
        },
        [stack]
    )

    const close = useCallback(() => {
        stack.closeKind('select')
    }, [stack])

    return useMemo(
        () => ({
            select,
            close
        }),
        [select, close]
    )
}
