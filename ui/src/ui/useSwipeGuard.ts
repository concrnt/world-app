import { useCallback, useEffect, useRef, type RefObject } from 'react'

export type SwipeAxis = 'x' | 'y'

// 自前で方向を決め始める指の移動量(px)。ブラウザがスクロールを開始するしきい値
// (iOS≈10pt / Android≈8dp)より手前で決めないと、横スワイプ中にブラウザが
// 縦スクロールとしてタッチを奪い pointercancel が飛んでくる
const DECIDE_THRESHOLD = 6

export interface SwipeGuard<T extends HTMLElement> {
    ref: RefObject<T | null>
    // motion の dragDirectionLock が決めた軸。pointerdown ごとにリセットされる
    lockedDirection: RefObject<SwipeAxis | null>
    onDirectionLock: (axis: SwipeAxis) => void
}

// motion の onDragEnd は pointerup だけでなく pointercancel でも呼ばれる。
// pointercancel はブラウザがタッチをスクロール等として奪ったときに飛び、指はまだ
// 画面上にあるので、残る/消えるの判定をしてはいけない(元の位置へ戻すだけ)
export const isSwipeCancelled = (event: Event): boolean => event.type === 'pointercancel'

const hasOverflowingHorizontalScroller = (from: EventTarget | null, until: HTMLElement): boolean => {
    let el = from instanceof Element ? from : null
    while (el && el !== until) {
        if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth) {
            const overflowX = getComputedStyle(el).overflowX
            if (overflowX === 'auto' || overflowX === 'scroll') return true
        }
        el = el.parentElement
    }
    return false
}

// motion の drag="x" + dragDirectionLock で横スワイプする要素のためのガード。
//
// touch-action: pan-y は祖先の要素には効かず(タッチ先からいちばん近いスクロール
// コンテナまでの要素しか見られない)、ブラウザは横スワイプ中でも都合次第でタッチを
// スクロールとして奪い pointercancel を飛ばす。motion はこれを pointerup と同じ扱いで
// onDragEnd に流すため、指を離す前にスワイプが「完了」してしまう。
//
// ここでは要素が pointerdown を受け取ったジェスチャについて、横方向と判断できた時点から
// touchmove を preventDefault してブラウザにスクロールを始めさせない(指に追従し続ける)。
// 横にあふれているスクロールコンテナの中から始まったタッチはブラウザに譲る。
export const useSwipeGuard = <T extends HTMLElement = HTMLDivElement>(enabled = true): SwipeGuard<T> => {
    const ref = useRef<T | null>(null)
    const lockedDirection = useRef<SwipeAxis | null>(null)

    const onDirectionLock = useCallback((axis: SwipeAxis) => {
        lockedDirection.current = axis
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el || !enabled) return

        let armed = false
        let yieldToBrowser = false
        let decided: SwipeAxis | null = null
        let startX = 0
        let startY = 0

        const disarm = (): void => {
            armed = false
            yieldToBrowser = false
            decided = null
        }

        // 子の HorizontalLayout 等が pointerdown を止めた場合はここに届かない(= motion もdragしない)
        const onPointerDown = (e: PointerEvent): void => {
            // onDragStart は frame 経由の遅延実行で同期発火の onDirectionLock より後に走ることが
            // あるため、ロック方向のリセットはジェスチャの先頭であるここで行う
            lockedDirection.current = null
            disarm()
            if (e.pointerType === 'touch' && e.isPrimary) armed = true
        }

        const onTouchStart = (e: TouchEvent): void => {
            if (e.touches.length !== 1) {
                disarm()
                return
            }
            startX = e.touches[0].clientX
            startY = e.touches[0].clientY
            yieldToBrowser = hasOverflowingHorizontalScroller(e.target, el)
        }

        const onTouchMove = (e: TouchEvent): void => {
            if (!armed || yieldToBrowser) return
            if (e.touches.length !== 1) {
                disarm()
                return
            }
            const dx = e.touches[0].clientX - startX
            const dy = e.touches[0].clientY - startY

            // motion のロックが決まっていればそれを優先し、まだなら自前で先に決める
            let axis = lockedDirection.current
            if (axis === null) {
                if (decided === null && Math.max(Math.abs(dx), Math.abs(dy)) >= DECIDE_THRESHOLD) {
                    decided = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
                }
                axis = decided
            }

            // cancelable=false は既にブラウザがスクロール中(preventDefault は無効で警告だけ出る)
            if (axis === 'x' && e.cancelable) e.preventDefault()
        }

        el.addEventListener('pointerdown', onPointerDown)
        el.addEventListener('touchstart', onTouchStart, { passive: true })
        el.addEventListener('touchmove', onTouchMove, { passive: false })
        el.addEventListener('touchend', disarm)
        el.addEventListener('touchcancel', disarm)
        return () => {
            el.removeEventListener('pointerdown', onPointerDown)
            el.removeEventListener('touchstart', onTouchStart)
            el.removeEventListener('touchmove', onTouchMove)
            el.removeEventListener('touchend', disarm)
            el.removeEventListener('touchcancel', disarm)
        }
    }, [enabled])

    return { ref, lockedDirection, onDirectionLock }
}
