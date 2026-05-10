import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useEmojiPicker, Emoji } from '../contexts/EmojiPicker'
import { CssVar } from '../types/Theme'

interface Props {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
    text: string
    setText: (text: string) => void
    updateEmojiDict: React.Dispatch<React.SetStateAction<Record<string, { imageURL: string }>>>
}

export const EmojiSuggestion = (props: Props) => {
    const emojiPicker = useEmojiPicker()

    const [cursorPos, setCursorPos] = useState<number>(0)
    const [forceOff, setForceOff] = useState(false)

    // カーソル位置を追跡
    useEffect(() => {
        const ta = props.textareaRef.current
        if (!ta) return

        const updateCursor = () => {
            setCursorPos(ta.selectionEnd ?? 0)
            setForceOff(false)
        }

        ta.addEventListener('input', updateCursor)
        ta.addEventListener('click', updateCursor)
        ta.addEventListener('keyup', updateCursor)

        return () => {
            ta.removeEventListener('input', updateCursor)
            ta.removeEventListener('click', updateCursor)
            ta.removeEventListener('keyup', updateCursor)
        }
    }, [props.textareaRef])

    // カーソル前のテキストから `:query` パターンを検出
    const query = useMemo(() => {
        const before = props.text.slice(0, cursorPos)
        const match = /:(\w+)$/.exec(before)
        return match?.[1] ?? null
    }, [props.text, cursorPos])

    // 検索結果
    const suggestions = useMemo(() => {
        if (!query) return []
        return emojiPicker.search(query, 16)
    }, [query, emojiPicker])

    const showSuggestions = query !== null && suggestions.length > 0 && !forceOff

    const onConfirm = (emoji: Emoji) => {
        const before = props.text.slice(0, cursorPos)
        const after = props.text.slice(cursorPos)
        const colonPos = before.lastIndexOf(':')
        if (colonPos === -1) return

        const newText = before.slice(0, colonPos) + `:${emoji.shortcode}: ` + after
        props.setText(newText)

        props.updateEmojiDict((prev) => ({
            ...prev,
            [emoji.shortcode]: { imageURL: emoji.imageURL }
        }))

        setForceOff(true)

        // カーソルを挿入位置の後ろに移動
        requestAnimationFrame(() => {
            const ta = props.textareaRef.current
            if (ta) {
                const newPos = colonPos + emoji.shortcode.length + 3 // `:shortcode: ` の長さ
                ta.setSelectionRange(newPos, newPos)
                ta.focus()
            }
        })
    }

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
                        {suggestions.map((emoji) => (
                            <button
                                key={emoji.shortcode}
                                onMouseDown={(e) => {
                                    e.preventDefault() // textareaのblurを防ぐ
                                    onConfirm(emoji)
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: CssVar.space(1),
                                    border: 'none',
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
