import type { ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { useTheme } from '@concrnt/ui'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
    children?: ReactNode
    variant?: 'classic' | 'world'
    style?: React.CSSProperties
}

export const View = (props: Props) => {
    const theme = useTheme()
    const isMobile = useIsMobile()
    const variant = props.variant ?? theme.variant

    if (variant === 'classic') {
        return (
            <div
                data-testid="view-classic"
                style={{
                    width: '100%',
                    height: isMobile ? '100%' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    color: CssVar.contentText,
                    backgroundColor: CssVar.contentBackground,
                    // 末尾の読み込みでブラウザがスクロール位置を補正して震えるのを止める
                    overflowAnchor: isMobile ? undefined : 'none',
                    ...props.style
                }}
            >
                {props.children}
            </div>
        )
    } else {
        return (
            <div
                data-testid="view-world"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    color: CssVar.contentText,
                    backgroundColor: CssVar.contentBackground,
                    borderRadius: CssVar.round(1),
                    overflow: isMobile ? 'hidden' : 'visible',
                    flex: isMobile ? 1 : undefined,
                    overflowAnchor: isMobile ? undefined : 'none',
                    // モバイル幅ではデスクトップのカードラッパーが無いので、
                    // ui版View(=app版の見た目)と同じマージンをここで持つ
                    ...(isMobile && {
                        margin: `env(safe-area-inset-top) ${CssVar.space(1)} ${CssVar.space(1)} ${CssVar.space(1)}`
                    }),
                    ...props.style
                }}
            >
                {props.children}
            </div>
        )
    }
}
