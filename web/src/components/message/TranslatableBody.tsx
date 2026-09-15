import type { ReactNode } from 'react'
import { Button } from '@concrnt/ui'
import { useMessageTranslation } from '../../contexts/MessageTranslation'

interface Props {
    // 原文の描画
    children: ReactNode
    // 訳文の描画(原文と同じレンダラに通す)
    renderTranslated: (text: string) => ReactNode
}

// 原文直前に小さな「翻訳を表示」ボタンを置き、押すと本文を訳文に差し替える。
// 表示モードや翻訳状態は MessageTranslationProvider が持つ(メニュー経由・自動翻訳の差し替えもここに反映される)
export const TranslatableBody = (props: Props) => {
    const mt = useMessageTranslation()
    const body = mt?.showTranslated && mt.translated ? props.renderTranslated(mt.translated.text) : props.children

    if (!mt || mt.mode !== 'inline') return <>{body}</>

    return (
        <>
            <Button
                variant="text"
                disabled={mt.working}
                onClick={(e) => {
                    // MessageLayout の onClick(投稿詳細へ遷移)に届かせない
                    e.stopPropagation()
                    mt.toggle()
                }}
                style={{
                    fontSize: '0.75rem',
                    padding: 0,
                    alignSelf: 'flex-start',
                    opacity: 0.8
                }}
            >
                {mt.label}
            </Button>
            {body}
        </>
    )
}
