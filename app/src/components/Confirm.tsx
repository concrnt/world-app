import { type ReactNode, useEffect, useRef } from 'react'
import { ask } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import { Confirm as DomConfirm } from '@concrnt/ui'

// @concrnt/ui の Confirm と同一propsのドロップイン置換。
// アプリ版では文字列だけの確認はOSネイティブダイアログで表示し、
// descriptionにJSXを渡した場合(リッチな表示が必要な特別な理由がある場合)のみDOM版に委譲する。
interface Props {
    open: boolean
    onClose: () => void
    title: string
    onConfirm: () => void
    description?: ReactNode
    confirmText?: string
    cancelText?: string
}

export const Confirm = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'common' })
    const needsDom = props.description !== undefined && typeof props.description !== 'string'

    // ネイティブダイアログ表示中に親が再レンダーしても最新のコールバックを呼ぶ
    const onConfirmRef = useRef(props.onConfirm)
    const onCloseRef = useRef(props.onClose)
    useEffect(() => {
        onConfirmRef.current = props.onConfirm
        onCloseRef.current = props.onClose
    })

    useEffect(() => {
        if (needsDom || !props.open) return
        let active = true
        const description = typeof props.description === 'string' ? props.description : undefined
        ask(description ?? props.title, {
            title: description !== undefined ? props.title : undefined,
            kind: 'warning',
            okLabel: props.confirmText ?? 'Confirm',
            cancelLabel: props.cancelText ?? t('cancel')
        })
            .then((ok) => {
                if (!active) return
                if (ok) onConfirmRef.current()
                onCloseRef.current()
            })
            .catch(() => {
                if (active) onCloseRef.current()
            })
        return () => {
            active = false
        }
        // openの立ち上がりでのみ表示する(文言の変化で再表示しない)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.open, needsDom])

    if (needsDom) return <DomConfirm {...props} />
    return null
}
