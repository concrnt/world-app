import { ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, CssVar } from '@concrnt/ui'

const clipHeight = 450
const gradationHeight = 80

interface Props {
    forceExpanded?: boolean
    children: ReactNode
}

export const CollapsibleBody = (props: Props) => {
    const [expanded, setExpanded] = useState(props.forceExpanded ?? false)
    const { t } = useTranslation('', { keyPrefix: 'components.collapsibleBody' })

    return (
        <div
            style={{
                position: 'relative',
                maxHeight: expanded ? undefined : `${clipHeight}px`,
                overflow: expanded ? undefined : 'hidden'
            }}
        >
            <div
                style={{
                    display: expanded ? 'none' : 'flex',
                    position: 'absolute',
                    top: `${clipHeight - gradationHeight}px`,
                    left: 0,
                    width: '100%',
                    height: `${gradationHeight}px`,
                    background: `linear-gradient(transparent, ${CssVar.contentBackground})`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1
                }}
            >
                <Button
                    onClick={(e) => {
                        e.stopPropagation()
                        setExpanded(true)
                    }}
                >
                    {t('showMore')}
                </Button>
            </div>
            {props.children}
        </div>
    )
}
