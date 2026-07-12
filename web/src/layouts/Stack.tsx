import { ReactNode, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { MdArrowBack } from 'react-icons/md'
import { CssVar } from '../types/Theme'

// app/src/layouts/Stack.tsx のSwipableViewの移植。appはスタックのpopに使うが、
// webではreact-routerのブラウザバックに接続する。子がdragを持つことで、
// 親のSidebarLayoutのdrag(スワイプでサイドバーを開く)には横スワイプが届かなくなる
export const SwipableView = ({ onPop, children }: { onPop: () => void; children: ReactNode }) => {
    const { t } = useTranslation('', { keyPrefix: 'common' })

    const width = window.innerWidth

    const x = useMotionValue(width)

    useEffect(() => {
        const controls = animate(x, 0, { duration: 0.12 })
        return () => controls.stop()
    }, [x])

    const popDistance = Math.max(80, width * 0.3) // 画面幅の30% or 80px
    const popVelocity = 50 // px/s 目安

    const hintOpacity = useTransform(x, [0, popDistance], [0, 1])

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden'
            }}
        >
            <motion.div
                style={{
                    position: 'absolute',
                    top: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: CssVar.space(2),
                    paddingLeft: CssVar.space(6),
                    color: CssVar.backdropText,
                    pointerEvents: 'none',
                    opacity: hintOpacity
                }}
            >
                <MdArrowBack size={24} />
                {t('swipeBack')}
            </motion.div>

            <motion.div
                style={{
                    position: 'absolute',
                    top: 0,
                    width: '100%',
                    height: '100%',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: CssVar.backdropBackground,
                    x
                }}
                drag="x"
                dragDirectionLock
                dragElastic={0}
                dragMomentum={false}
                dragConstraints={{ left: 0, right: width }}
                onDragEnd={(_, info) => {
                    const shouldPop = info.offset.x > popDistance || info.velocity.x > popVelocity

                    if (shouldPop) {
                        animate(x, width, { duration: 0.12 }).then(() => {
                            onPop()
                        })
                    } else {
                        animate(x, 0, { duration: 0.12 })
                    }
                }}
            >
                {children}
            </motion.div>
        </div>
    )
}
