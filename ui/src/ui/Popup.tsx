import { useEffect, useId, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CssVar } from '../types/Theme'

interface Props {
    open: boolean
    trigger: ReactNode
    children: ReactNode
    onOpenChange?: (open: boolean) => void
    style?: CSSProperties
    popupStyle?: CSSProperties
}

interface AnchorStyle extends CSSProperties {
    anchorName?: string
}

interface PopupStyle extends CSSProperties {
    positionAnchor?: string
    positionTry?: string
    positionTryFallbacks?: string
    positionTryOrder?: CSSProperties['positionTryOrder']
}

export const Popup = (props: Props) => {
    const popupId = useId().replace(/:/g, '')
    const rootRef = useRef<HTMLDivElement | null>(null)
    const popupRef = useRef<HTMLDivElement | null>(null)
    const anchorName = `--popup-anchor-${popupId}`

    useEffect(() => {
        if (!props.open) return

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null
            if (!target) return
            if (rootRef.current?.contains(target)) return
            if (popupRef.current?.contains(target)) return
            props.onOpenChange?.(false)
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                props.onOpenChange?.(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [props.open, props.onOpenChange])

    const popup =
        props.open && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      ref={popupRef}
                      style={
                          {
                              position: 'fixed',
                              top: `calc(anchor(bottom) + ${CssVar.space(2)})`,
                              left: 'anchor(left)',
                              positionAnchor: anchorName,
                              positionTry: 'most-block-size flip-block, flip-inline, flip-block flip-inline',
                              positionTryFallbacks: 'flip-block, flip-inline, flip-block flip-inline',
                              positionTryOrder: 'most-block-size',
                              minWidth: '280px',
                              maxWidth: 'min(420px, 90vw)',
                              maxHeight: 'min(70dvh, 520px)',
                              overflow: 'auto',
                              borderRadius: CssVar.round(1),
                              border: `1px solid ${CssVar.divider}`,
                              backgroundColor: CssVar.contentBackground,
                              color: CssVar.contentText,
                              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
                              zIndex: 1000,
                              ...props.popupStyle
                          } as PopupStyle
                      }
                  >
                      {props.children}
                  </div>,
                  document.body
              )
            : null

    return (
        <div
            ref={rootRef}
            style={{
                position: 'relative',
                display: 'inline-flex',
                ...props.style
            }}
        >
            <div
                style={
                    {
                        display: 'inline-flex',
                        anchorName
                    } as AnchorStyle
                }
            >
                {props.trigger}
            </div>
            {popup}
        </div>
    )
}
