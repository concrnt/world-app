import { CSSProperties, ReactNode, useState } from 'react'
import { MdCloudOff } from 'react-icons/md'
import { useNavigation } from '../contexts/Navigation'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'
import { IconButton, Popover, useAnchor, useTheme } from '@concrnt/ui'
import { ConnectionStatus } from './ConnectionStatus'

interface Props {
    children?: ReactNode
    leftOverride?: ReactNode
    right?: ReactNode
    onTitleTap?: () => void
}

export const Header = (props: Props) => {
    const theme = useTheme()

    const nav = useNavigation()

    // ホームドメイン切断中はrightスロットの左に雲アイコンを出し、タップで再接続状況をポップオーバー表示する
    const { isDomainOffline } = useClient()
    const statusAnchor = useAnchor()
    const [statusOpen, setStatusOpen] = useState(false)

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: CssVar.space(1),
                color: theme.variant === 'classic' ? CssVar.backdropText : CssVar.uiText,
                backgroundColor: theme.variant === 'classic' ? CssVar.backdropBackground : CssVar.uiBackground,
                paddingTop: theme.variant === 'classic' ? 'env(safe-area-inset-top)' : CssVar.space(1),
                borderBottom: `1px solid ${CssVar.divider}`
            }}
        >
            <div
                style={{
                    height: '40px',
                    width: '40px'
                }}
            >
                {props.leftOverride ?? nav.backNode}
            </div>
            <div
                style={{
                    flexGrow: 1,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    cursor: props.onTitleTap ? 'pointer' : undefined
                }}
                onClick={props.onTitleTap}
            >
                {props.children}
            </div>
            {isDomainOffline && (
                <div
                    data-testid="header-connection-status"
                    style={{
                        height: '40px',
                        width: '40px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <IconButton
                        onClick={() => setStatusOpen(true)}
                        style={{ anchorName: statusAnchor, color: 'inherit' } as CSSProperties}
                    >
                        <MdCloudOff size={24} />
                    </IconButton>
                    <Popover
                        open={statusOpen}
                        onClose={() => setStatusOpen(false)}
                        anchor={statusAnchor}
                        style={{
                            left: 'auto',
                            right: 'anchor(right)',
                            padding: CssVar.space(2),
                            maxWidth: 'min(320px, calc(100vw - 16px))'
                        }}
                    >
                        <ConnectionStatus />
                    </Popover>
                </div>
            )}
            <div
                style={{
                    height: '40px',
                    width: '40px'
                }}
            >
                {props.right}
            </div>
        </div>
    )
}
