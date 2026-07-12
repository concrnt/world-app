import { Fragment, type ReactNode, useCallback, useMemo } from 'react'
import { useOverlayStack, BottomSheet, Popover, List, Text, CssVar } from '@concrnt/ui'
import { useIsMobile } from '../hooks/useIsMobile'

interface SelectState {
    select: (title: string, options: ReactNode[], anchor?: string) => void
    close: () => void
}

// ui/contexts/Select.tsx のweb版。モバイルはBottomSheet(uiと同じ)、
// デスクトップはトリガー脇のPopoverで表示する。anchor はトリガー側が
// style={{ anchorName: useAnchor()の値 }} で宣言したアンカー名(省略時はBottomSheetにフォールバック)。
// appの useSelect とは第3引数の有無だけ異なる(optionalなので呼び出しは互換)
export const useSelect = (): SelectState => {
    const stack = useOverlayStack()
    const isMobile = useIsMobile()

    const select = useCallback(
        (title: string, options: ReactNode[], anchor?: string) => {
            if (isMobile || !anchor) {
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
                return
            }

            stack.push({
                kind: 'select',
                render: (close) => (
                    <Popover open anchor={anchor} onClose={close} style={{ minWidth: '180px' }}>
                        {title && (
                            <div
                                style={{
                                    borderBottom: `1px solid ${CssVar.divider}`,
                                    padding: `${CssVar.space(1)} ${CssVar.space(2)}`
                                }}
                            >
                                <Text>{title}</Text>
                            </div>
                        )}
                        <List style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {options.map((opt, i) => (
                                <Fragment key={i}>{opt}</Fragment>
                            ))}
                        </List>
                    </Popover>
                )
            })
        },
        [stack, isMobile]
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
