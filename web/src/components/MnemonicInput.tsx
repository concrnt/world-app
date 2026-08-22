import { GetMnemonicWords } from '@concrnt/client'
import { CssVar, Text } from '@concrnt/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const MNEMONIC_WORD_COUNT = 12

const DANGER_COLOR = '#ff5b5b'

// 欄に入れる語形。全角英数は半角へ寄せ、かなは結合済みのまま保つ(単語帳との照合は別途NFKDで行う)
const normalizeWord = (word: string): string => word.normalize('NFKC').trim().toLowerCase()
const nfkd = (word: string): string => word.normalize('NFKD')

// サブキー文字列や生秘密鍵など、単語帳とは無関係な入力
const isRawSecret = (text: string): boolean =>
    text.startsWith('concrnt-subkey') || /^(?:0x)?[0-9a-fA-F]{64}$/.test(text)

interface Props {
    words: string[]
    onChange: (words: string[]) => void
    // 12語のマスターキー以外(サブキー・hex秘密鍵)が貼り付け/入力されたときに呼ばれる
    onRawInput?: (text: string) => void
}

export const MnemonicInput = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.mnemonicInput' })
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
    const [composing, setComposing] = useState(false)
    const [keyboardInset, setKeyboardInset] = useState(0)

    const wordlist = useMemo(() => [...GetMnemonicWords('en'), ...GetMnemonicWords('ja')], [])
    const wordSet = useMemo(() => new Set(wordlist), [wordlist])
    const isWord = (word: string) => wordSet.has(nfkd(word))
    // wordを先頭に持つ、より長い単語が存在するか(存在する間は入力途中とみなし自動で次へ進めない)
    const isPrefixOfLonger = (word: string) => {
        const key = nfkd(word)
        return wordlist.some((w) => w.length > key.length && w.startsWith(key))
    }
    const isPrefix = (word: string) => isWord(word) || isPrefixOfLonger(word)

    // 区切りなしで続けて入力された文字列を、単語帳の単語列へ切り分ける。
    // 末尾の要素だけは入力途中(いずれかの単語の先頭部分)を許す。切り分けられなければそのまま返す
    const splitTyped = (text: string): string[] => {
        if (isPrefix(text)) return [text]
        for (let i = text.length - 1; i > 0; i--) {
            const head = text.slice(0, i)
            const rest = text.slice(i)
            if (!isWord(head)) continue
            if (isPrefix(rest)) return [head, rest]
            const restSplit = splitTyped(rest)
            if (restSplit.length > 1) return [head, ...restSplit]
        }
        return [text]
    }

    // 貼り付けで全語が連結された文字列を12語へ切り分ける。全語が単語帳に一致する分割のみ採用し、
    // 複数の分割が可能なら12語ちょうどになるものを優先する
    const splitPasted = (text: string): string[] | null => {
        const search = (pos: number, remaining: number | null, memo: Set<string>): string[] | null => {
            if (pos === text.length) return remaining === null || remaining === 0 ? [] : null
            if (remaining === 0) return null
            const key = `${pos}:${remaining}`
            if (memo.has(key)) return null
            for (let len = Math.min(text.length - pos, 12); len > 0; len--) {
                const head = text.slice(pos, pos + len)
                if (!isWord(head)) continue
                const rest = search(pos + len, remaining === null ? null : remaining - 1, memo)
                if (rest) return [head, ...rest]
            }
            memo.add(key)
            return null
        }
        return search(0, MNEMONIC_WORD_COUNT, new Set()) ?? search(0, null, new Set())
    }

    const focusInput = (index: number) => {
        const el = inputRefs.current[index]
        if (!el) return
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
    }

    // index番目からtokensを順に書き込む。書き込み先はその場所から後ろへ続け、末尾が12語を超える分は切り捨てる
    const fillFrom = (index: number, tokens: string[], base: string[]) => {
        const next = [...base]
        let cursor = index
        for (const token of tokens) {
            if (cursor >= MNEMONIC_WORD_COUNT) break
            next[cursor] = token
            cursor++
        }
        props.onChange(next)
        return cursor
    }

    const handleChange = (index: number, raw: string) => {
        if (composing) {
            const next = [...props.words]
            next[index] = raw
            props.onChange(next)
            return
        }
        commitInput(index, raw)
    }

    const commitInput = (index: number, raw: string) => {
        if (isRawSecret(raw.trim()) && props.onRawInput) {
            props.onRawInput(raw.trim())
            return
        }

        const tokens = raw
            .split(/[\s\u3000]+/)
            .map(normalizeWord)
            .filter((token) => token.length > 0)

        if (tokens.length === 0) {
            const next = [...props.words]
            next[index] = ''
            props.onChange(next)
            return
        }

        // 空白が含まれていれば区切りとして扱い、各語について区切りなし連結の切り分けも試みる
        const split = tokens.flatMap(splitTyped)

        // 既に後ろの欄が埋まっている場合、溢れた分で上書きしない(この欄に残してエラー表示に任せる)
        const overflowAllowed = props.words.slice(index + 1, index + split.length).every((w) => w === '')
        const placed = overflowAllowed ? split : [split.join('')]
        const cursor = fillFrom(index, placed, props.words)

        const last = placed[placed.length - 1]
        const lastIndex = cursor - 1
        const endedWithSeparator = /[\s\u3000]$/.test(raw)
        const completed = isWord(last) && (!isPrefixOfLonger(last) || endedWithSeparator)
        // 確定した語の次へ進む。切り分けで末尾が入力途中なら、その途中語の欄へ移る
        let target: number | null = null
        if (completed) target = lastIndex + 1
        else if (lastIndex > index) target = lastIndex
        if (target !== null && target < MNEMONIC_WORD_COUNT) {
            const next = target
            requestAnimationFrame(() => focusInput(next))
        }
    }

    const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text')
        if (!text) return
        e.preventDefault()

        const trimmed = text.trim()
        if (isRawSecret(trimmed) && props.onRawInput) {
            props.onRawInput(trimmed)
            return
        }

        let tokens = trimmed
            .split(/[\s\u3000]+/)
            .map(normalizeWord)
            .filter((token) => token.length > 0)
        if (tokens.length === 1) {
            tokens = splitPasted(tokens[0]) ?? tokens
        }
        if (tokens.length === 0) return

        // 12語まとめての貼り付けは、どの欄に貼られても先頭から埋める
        const start = tokens.length >= MNEMONIC_WORD_COUNT ? 0 : index
        const cursor = fillFrom(start, tokens, props.words)
        requestAnimationFrame(() => focusInput(Math.min(cursor, MNEMONIC_WORD_COUNT - 1)))
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (composing) return
        const el = e.currentTarget
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            if (el.value.trim().length > 0 && index < MNEMONIC_WORD_COUNT - 1) focusInput(index + 1)
            return
        }
        if (e.key === 'Backspace' && el.value.length === 0 && index > 0) {
            e.preventDefault()
            focusInput(index - 1)
            return
        }
        if (e.key === 'ArrowLeft' && el.selectionStart === 0 && el.selectionEnd === 0 && index > 0) {
            e.preventDefault()
            focusInput(index - 1)
            return
        }
        if (
            e.key === 'ArrowRight' &&
            el.selectionStart === el.value.length &&
            el.selectionEnd === el.value.length &&
            index < MNEMONIC_WORD_COUNT - 1
        ) {
            e.preventDefault()
            focusInput(index + 1)
        }
    }

    // モバイルでソフトキーボードに入力欄が隠れないよう、キーボード分の余白を確保してフォーカス欄を画面内へ寄せる
    useEffect(() => {
        if (focusedIndex === null) return
        const vv = window.visualViewport
        const update = () => {
            const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
            setKeyboardInset(inset)
            inputRefs.current[focusedIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        const timer = setTimeout(update, 300)
        vv?.addEventListener('resize', update)
        return () => {
            clearTimeout(timer)
            vv?.removeEventListener('resize', update)
        }
    }, [focusedIndex])

    const invalidIndices = props.words
        .map((word, index) => ({ word, index }))
        .filter(({ word, index }) => {
            if (word === '') return false
            if (isWord(word)) return false
            // 入力中の欄は、いずれかの単語の途中である限りエラーにしない
            if (index === focusedIndex && isPrefix(word)) return false
            return true
        })
        .map(({ index }) => index)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2), width: '100%' }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))',
                    gap: CssVar.space(2),
                    width: '100%'
                }}
            >
                {props.words.map((word, index) => {
                    const invalid = invalidIndices.includes(index)
                    const focused = focusedIndex === index
                    return (
                        <div key={index} style={{ position: 'relative', minWidth: 0 }}>
                            <span
                                style={{
                                    position: 'absolute',
                                    left: 8,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '12px',
                                    lineHeight: 1,
                                    color: invalid ? DANGER_COLOR : CssVar.contentText,
                                    opacity: invalid ? 1 : 0.5,
                                    pointerEvents: 'none',
                                    userSelect: 'none'
                                }}
                            >
                                {index + 1}
                            </span>
                            <input
                                ref={(el) => {
                                    inputRefs.current[index] = el
                                }}
                                type="text"
                                value={word}
                                aria-label={t('wordLabel', { index: index + 1 })}
                                aria-invalid={invalid}
                                autoCapitalize="none"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck={false}
                                enterKeyHint={index === MNEMONIC_WORD_COUNT - 1 ? 'done' : 'next'}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onPaste={(e) => handlePaste(index, e)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onCompositionStart={() => setComposing(true)}
                                onCompositionEnd={(e) => {
                                    setComposing(false)
                                    commitInput(index, e.currentTarget.value)
                                }}
                                onFocus={() => setFocusedIndex(index)}
                                onBlur={() => setFocusedIndex((prev) => (prev === index ? null : prev))}
                                style={{
                                    width: '100%',
                                    padding: '10px 8px 10px 24px',
                                    fontSize: '16px',
                                    borderRadius: '4px',
                                    border: `1px solid ${invalid ? DANGER_COLOR : focused ? CssVar.contentText : CssVar.divider}`,
                                    backgroundColor: CssVar.contentBackground,
                                    color: invalid ? DANGER_COLOR : CssVar.contentText,
                                    boxShadow: 'none',
                                    outline: 'none',
                                    appearance: 'none',
                                    WebkitAppearance: 'none'
                                }}
                            />
                        </div>
                    )
                })}
            </div>
            {invalidIndices.length > 0 && (
                <Text style={{ color: DANGER_COLOR, fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {t('unknownWords', {
                        positions: invalidIndices.map((index) => index + 1).join(', ')
                    })}
                </Text>
            )}
            {keyboardInset > 0 && focusedIndex !== null && <div style={{ height: keyboardInset, flexShrink: 0 }} />}
        </div>
    )
}
