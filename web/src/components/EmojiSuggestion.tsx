import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useEmojiPicker } from '../contexts/EmojiPicker'
import { CssVar } from '../types/Theme'
import { CCImage } from '@concrnt/ui'

interface Props {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
    text: string
    setText: (text: string) => void
    updateEmojiDict: React.Dispatch<React.SetStateAction<Record<string, { imageURL: string }>>>
}

export const EmojiSuggestion = ({ textareaRef, text, setText, updateEmojiDict }: Props) => {
    const emojiPicker = useEmojiPicker()

    const [selectedIndex, setSelectedIndex] = useState<number>(0)

    // カーソル位置とフォーカスはstateとして持たず、DOMを直接読む。
    // カーソル移動はReactの再レンダーを起こさないため、selectionchange/focus/blurの購読で通知だけ受ける
    // (selectionchangeはtext control自体をターゲットにするブラウザとdocumentにしか発火しないブラウザがあるため両方に登録)
    const subscribe = useCallback(
        (onChange: () => void) => {
            const ta = textareaRef.current
            if (!ta) return () => {}
            ta.addEventListener('focus', onChange)
            ta.addEventListener('blur', onChange)
            ta.addEventListener('selectionchange', onChange)
            document.addEventListener('selectionchange', onChange)
            return () => {
                ta.removeEventListener('focus', onChange)
                ta.removeEventListener('blur', onChange)
                ta.removeEventListener('selectionchange', onChange)
                document.removeEventListener('selectionchange', onChange)
            }
        },
        [textareaRef]
    )
    const cursorPos = useSyncExternalStore(subscribe, () => textareaRef.current?.selectionEnd ?? 0)
    const focused = useSyncExternalStore(subscribe, () => document.activeElement === textareaRef.current)

    // カーソル前のテキストから `:query` パターンを検出
    // 先頭ガードで、完結済み `:name:` の閉じコロンやURLのポート番号をトリガーと誤認しない
    const query = useMemo(() => {
        const before = text.slice(0, cursorPos)
        const match = /(?:^|[^\w:]):(\w+)$/.exec(before)
        return match?.[1] ?? null
    }, [text, cursorPos])

    // 検索結果
    const suggestions = useMemo(() => {
        if (!query) return []
        return emojiPicker.search(query, 16)
    }, [query, emojiPicker])

    const showSuggestions = focused && query !== null && suggestions.length > 0

    // query が変わったら選択をリセット（レンダー中のstate調整パターン）
    const [prevQuery, setPrevQuery] = useState(query)
    if (query !== prevQuery) {
        setPrevQuery(query)
        setSelectedIndex(0)
    }

    const onConfirm = useCallback(
        (index: number) => {
            const before = text.slice(0, cursorPos)
            const after = text.slice(cursorPos)
            const colonPos = before.lastIndexOf(':')
            if (colonPos === -1) return

            const emoji = suggestions[index]
            if (!emoji) return

            const newText = before.slice(0, colonPos) + `:${emoji.shortcode}: ` + after
            setText(newText)
            setSelectedIndex(0)

            updateEmojiDict((prev) => ({
                ...prev,
                [emoji.shortcode]: { imageURL: emoji.imageURL }
            }))

            // カーソルを挿入位置の後ろに移動
            // (setSelectionRangeがselectionchangeを発火するので、パレットは導出的に閉じる)
            const newPos = colonPos + emoji.shortcode.length + 3
            requestAnimationFrame(() => {
                const ta = textareaRef.current
                if (ta) {
                    ta.setSelectionRange(newPos, newPos)
                    ta.focus()
                }
            })
        },
        [text, cursorPos, suggestions, textareaRef, setText, updateEmojiDict]
    )

    // keydown: Enter確定 + 矢印キー移動（サジェスト表示中のみ）
    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!showSuggestions) return

            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault()
                setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
                return
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault()
                setSelectedIndex((prev) => (prev + 1) % suggestions.length)
                return
            }
            if (e.key === 'Enter') {
                e.preventDefault()
                onConfirm(selectedIndex)
            }
        },
        [showSuggestions, suggestions.length, selectedIndex, onConfirm]
    )

    useEffect(() => {
        const ta = textareaRef.current
        if (!ta) return

        ta.addEventListener('keydown', onKeyDown)

        return () => {
            ta.removeEventListener('keydown', onKeyDown)
        }
    }, [textareaRef, onKeyDown])

    return (
        <AnimatePresence>
            {showSuggestions && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ overflow: 'hidden' }}
                >
                    <div
                        style={{
                            display: 'flex',
                            overflowX: 'auto',
                            gap: CssVar.space(1),
                            padding: `${CssVar.space(1)} 0`,
                            WebkitOverflowScrolling: 'touch'
                        }}
                    >
                        {suggestions.map((emoji, index) => (
                            <button
                                key={emoji.shortcode}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    onConfirm(index)
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: CssVar.space(1),
                                    border:
                                        index === selectedIndex
                                            ? `2px solid ${CssVar.contentLink}`
                                            : '2px solid transparent',
                                    background: `rgb(from ${CssVar.contentText} r g b / 0.06)`,
                                    borderRadius: CssVar.round(0.5),
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    WebkitTapHighlightColor: 'transparent',
                                    color: CssVar.contentText
                                }}
                            >
                                <CCImage
                                    src={emoji.imageURL}
                                    maxHeight={128}
                                    alt={emoji.shortcode}
                                    style={{ width: '28px', height: '28px' }}
                                />
                                <span
                                    style={{
                                        fontSize: '10px',
                                        opacity: 0.6,
                                        maxWidth: '56px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {emoji.shortcode}
                                </span>
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
