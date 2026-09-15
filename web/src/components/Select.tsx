import { Fragment, type ReactNode } from 'react'
import { OverlaySurface, BottomSheet, Popover, List, Text, CssVar } from '@concrnt/ui'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
    open: boolean
    onClose: () => void
    title?: string
    // シートの高さを個数から見積もるため、childrenでなく配列で受ける
    options: ReactNode[]
    // トリガー側が style={{ anchorName: useAnchor()の値 }} で宣言したアンカー名(省略時はBottomSheetにフォールバック)
    anchor?: string
}

// ui/ui/Select.tsx のweb版。モバイルはBottomSheet(uiと同じ)、デスクトップはトリガー脇のPopoverで表示する。
// Popoverはネイティブのtop layerに出るのでOverlaySurface(portal)を経由しない。
// appの Select とは anchor の有無だけ異なる(optionalなので呼び出しは互換)
export const Select = (props: Props) => {
    const isMobile = useIsMobile()

    if (!isMobile && props.anchor) {
        // Popoverは呼び出し元ツリーに直接いるため、選択肢クリックが親(メッセージ行のonClick等)へ
        // Reactバブリングしてしまう。top layer表示でも合成イベントは遡るのでここで堰き止める
        const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
        return (
            <div
                style={{ display: 'contents' }}
                onClick={stop}
                onMouseDown={stop}
                onMouseUp={stop}
                onPointerDown={stop}
                onPointerUp={stop}
                onTouchStart={stop}
                onTouchEnd={stop}
                onKeyDown={stop}
                onKeyUp={stop}
            >
                <Popover open={props.open} anchor={props.anchor} onClose={props.onClose} style={{ minWidth: '180px' }}>
                    {props.title && (
                        <div
                            style={{
                                borderBottom: `1px solid ${CssVar.divider}`,
                                padding: `${CssVar.space(1)} ${CssVar.space(2)}`
                            }}
                        >
                            <Text>{props.title}</Text>
                        </div>
                    )}
                    <List style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {props.options.map((opt, i) => (
                            <Fragment key={i}>{opt}</Fragment>
                        ))}
                    </List>
                </Popover>
            </div>
        )
    }

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
