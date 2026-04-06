import { motion, useMotionValue, useTransform } from 'motion/react'
import { animate } from 'motion'
import { ReactNode, RefObject, useCallback, useEffect, useRef } from 'react'
import { MdArrowDownward, MdSync } from 'react-icons/md'
import { CssVar } from '../types/Theme'
import { hapticSelection } from '../utils/haptics'

/** リフレッシュ発動の閾値（px）。この高さ以上引っ張ると離した時にリフレッシュが走る */
const PTR_THRESHOLD = 60

/** ラバーバンドの最大引っ張り量（px）。見た目上これ以上は伸びない */
const MAX_PULL = 120

/**
 * ラバーバンド関数。引っ張るほど抵抗が増し、指の移動量に対する追従が鈍くなる。
 * iOSのオーバースクロールと同じ対数減衰カーブを近似している。
 *
 * @param rawDelta - 指の実際の移動量（px）
 * @returns 減衰後の表示上の引っ張り量（px）
 */
const rubberBand = (rawDelta: number): number => {
    if (rawDelta <= 0) return 0
    // 対数カーブ: 最初は素直に動き、引っ張るほど鈍くなる
    return MAX_PULL * (1 - Math.exp(-rawDelta / (MAX_PULL * 0.8)))
}

interface PullToRefreshProps {
    /** スクロール位置を追跡するref。値が0の時のみPTRが有効になる */
    scrollPositionRef: RefObject<number>
    /** データ取得中かどうか */
    isFetching: boolean
    /** リフレッシュ実行時のコールバック */
    onRefresh: () => Promise<void>
    children: ReactNode
}

export const PullToRefresh = (props: PullToRefreshProps) => {
    /**
     * タッチイベントを受け取るラッパー要素のref。
     * リファレンス実装と同じく、overflow: hidden のラッパーにイベントを付けて、
     * 子要素（スクロール要素）からバブリングで受け取る。
     */
    const scrollParentRef = useRef<HTMLDivElement>(null)

    /** 引っ張り量（px）。useMotionValueでReact再レンダリングを回避 */
    const pullDistance = useMotionValue(0)

    /** PTR閾値を超えたかどうか */
    const isOverThreshold = useRef(false)

    /** タッチ開始時のY座標 */
    const touchStartY = useRef(0)

    /** PTRが有効か（スクロール位置が先頭の時のみ） */
    const ptrEnabled = useRef(false)

    /** ローダー領域の高さ: 引っ張り量に連動 */
    const loaderHeight = useTransform(pullDistance, (v) => `${v}px`)

    /** 矢印アイコンの回転: 閾値未満なら下向き(0deg)、閾値以上なら上向き(180deg) */
    const arrowRotate = useTransform(pullDistance, (v) => (v >= PTR_THRESHOLD ? 'rotate(180deg)' : 'rotate(0deg)'))

    const onTouchStart = useCallback(
        (raw: Event) => {
            const e = raw as TouchEvent
            touchStartY.current = e.touches[0].clientY
            // スクロール位置が先頭の時のみPTRを有効にする
            ptrEnabled.current = (props.scrollPositionRef.current ?? 0) <= 1
            isOverThreshold.current = false
        },
        [props.scrollPositionRef]
    )

    const onTouchMove = useCallback(
        (raw: Event) => {
            if (!ptrEnabled.current) return
            const e = raw as TouchEvent
            const rawDelta = e.touches[0].clientY - touchStartY.current
            if (rawDelta <= 0) return
            // ラバーバンド効果: 引っ張るほど抵抗が増す
            const dampened = rubberBand(rawDelta)
            pullDistance.set(dampened)
            if (dampened >= PTR_THRESHOLD) {
                if (!isOverThreshold.current) {
                    hapticSelection()
                }
                isOverThreshold.current = true
            }
        },
        [pullDistance]
    )

    const onTouchEnd = useCallback(() => {
        // スプリングアニメーションで弾むように元に戻す
        animate(pullDistance, 0, {
            type: 'spring',
            stiffness: 300, // バネの硬さ。高いほど速く戻る
            damping: 25, // 減衰。低いほどバウンスが大きい
            mass: 0.8 // 質量。軽いほどキビキビ動く
        })

        if (isOverThreshold.current) {
            isOverThreshold.current = false
            if (props.isFetching) return
            props.onRefresh()
        }
    }, [pullDistance, props.isFetching, props.onRefresh])

    useEffect(() => {
        const el = scrollParentRef.current
        if (!el) return

        el.addEventListener('touchstart', onTouchStart)
        el.addEventListener('touchmove', onTouchMove)
        el.addEventListener('touchend', onTouchEnd)

        return () => {
            el.removeEventListener('touchstart', onTouchStart)
            el.removeEventListener('touchmove', onTouchMove)
            el.removeEventListener('touchend', onTouchEnd)
        }
    }, [scrollParentRef.current, onTouchStart, onTouchMove, onTouchEnd])

    return (
        <>
            {/* ローダー表示エリア */}
            <motion.div
                style={{
                    height: loaderHeight,
                    width: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                    color: CssVar.contentText,
                    display: 'flex'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: `${PTR_THRESHOLD}px`,
                        position: 'absolute',
                        width: '100%',
                        bottom: 0,
                        left: 0
                    }}
                >
                    {props.isFetching ? (
                        <MdSync
                            size={24}
                            style={{
                                animation: 'ptr-spin 1s linear infinite'
                            }}
                        />
                    ) : (
                        <motion.div style={{ rotate: arrowRotate, transition: 'rotate 0.2s ease-in-out' }}>
                            <MdArrowDownward size={24} />
                        </motion.div>
                    )}
                </div>
            </motion.div>

            {/* リファレンスと同じ構造: overflow: hidden のラッパーにタッチイベントを付ける */}
            <div
                ref={scrollParentRef}
                style={{
                    display: 'flex',
                    flex: 1,
                    overflow: 'hidden',
                    flexDirection: 'column'
                }}
            >
                {props.children}
            </div>

            {/* スピンアニメーション用CSS */}
            <style>{`
                @keyframes ptr-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }
            `}</style>
        </>
    )
}
