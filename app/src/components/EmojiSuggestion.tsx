import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useEmojiPicker } from '../contexts/EmojiPicker'
import { CssVar } from '../types/Theme'

interface Props {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
    text: string
    setText: (text: string) => void
    updateEmojiDict: React.Dispatch<React.SetStateAction<Record<string, { imageURL: string }>>>
}

export const EmojiSuggestion = ({ textareaRef, text, setText, updateEmojiDict }: Props) => {
    const emojiPicker = useEmojiPicker()

    const [cursorPos, setCursorPos] = useState<number>(0)
    const [forceOff, setForceOff] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState<number>(0)

    // カーソル前のテキストから `:query` パターンを検出
    const query = useMemo(() => {
        const before = text.slice(0, cursorPos)
        const match = /:(\w+)$/.exec(before)
        return match?.[1] ?? null
    }, [text, cursorPos])

    // 検索結果
    const suggestions = useMemo(() => {
        if (!query) return []
        return emojiPicker.search(query, 16)
    }, [query, emojiPicker])

    const showSuggestions = query !== null && suggestions.length > 0 && !forceOff

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

            setForceOff(true)

            // カーソルを挿入位置の後ろに移動
            requestAnimationFrame(() => {
                const ta = textareaRef.current
                if (ta) {
                    const newPos = colonPos + emoji.shortcode.length + 3
                    ta.setSelectionRange(newPos, newPos)
                    ta.focus()
                }
            })
        },
        [text, cursorPos, suggestions, textareaRef, setText, updateEmojiDict]
    )

    // カーソル位置の追跡
    useEffect(() => {
        const ta = textareaRef.current
        if (!ta) return

        const updateCursor = () => {
            setCursorPos(ta.selectionEnd ?? 0)
            setForceOff(false)
        }

        ta.addEventListener('input', updateCursor)
        ta.addEventListener('click', updateCursor)

        return () => {
            ta.removeEventListener('input', updateCursor)
            ta.removeEventListener('click', updateCursor)
        }
    }, [textareaRef])

    // keydown: Enter確定 + 矢印キー移動（サジェスト表示中のみ）
    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            setForceOff(false)
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

    const onBlur = useCallback(() => {
        setTimeout(() => {
            setForceOff(true)
        }, 100)
    }, [])

    useEffect(() => {
        const ta = textareaRef.current
        if (!ta) return

        ta.addEventListener('keydown', onKeyDown)
        ta.addEventListener('blur', onBlur)

        return () => {
            ta.removeEventListener('keydown', onKeyDown)
            ta.removeEventListener('blur', onBlur)
        }
    }, [textareaRef, onKeyDown, onBlur])

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
                                <img
                                    src={emoji.imageURL}
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
