import { CssVar, IconButton, Text } from '@concrnt/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdInfoOutline } from 'react-icons/md'
import { Drawer } from '../Drawer'

interface Props {
    message: string
    detail: string
}

// 表示エラーの1行メッセージ。文字サイズと同じ大きさのiボタンで、詳細(エラー内容)をドロワーから確認できる
export const ErrorNotice = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.errorNotice' })
    const [open, setOpen] = useState(false)

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(1)
            }}
        >
            <Text variant="caption">{props.message}</Text>
            <IconButton
                title={t('showDetails')}
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen(true)
                }}
                style={{
                    fontSize: '0.875em',
                    width: '1em',
                    height: '1em',
                    padding: 0,
                    flexShrink: 0
                }}
            >
                <MdInfoOutline size="1em" />
            </IconButton>
            <Drawer open={open} onClose={() => setOpen(false)}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        height: '100%',
                        overflowY: 'auto',
                        padding: '4px'
                    }}
                >
                    <Text variant="h1">{t('title')}</Text>
                    <Text>{props.message}</Text>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                        }}
                    >
                        {props.detail}
                    </pre>
                </div>
            </Drawer>
        </div>
    )
}
