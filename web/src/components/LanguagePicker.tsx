import { Chip, Popover, useAnchor } from '@concrnt/ui'

import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IoMdCloseCircle } from 'react-icons/io'
import { IoMdAdd } from 'react-icons/io'

import { CssVar } from '../types/Theme'
import { useHaptics } from '../contexts/Haptics'

// 候補言語(基底コード)。表示名は Intl.DisplayNames でUI言語に合わせる
const candidateLanguages = [
    'ja',
    'en',
    'zh',
    'ko',
    'fr',
    'de',
    'es',
    'it',
    'pt',
    'ru',
    'ar',
    'hi',
    'th',
    'vi',
    'id',
    'ms',
    'tr',
    'pl',
    'nl',
    'sv',
    'da',
    'fi',
    'no',
    'cs',
    'hu',
    'el',
    'he',
    'uk',
    'ro',
    'bg'
]

const languageName = (code: string, uiLanguage: string): string => {
    try {
        return new Intl.DisplayNames([uiLanguage], { type: 'language', fallback: 'code' }).of(code) ?? code
    } catch {
        return code
    }
}

interface Props {
    selected: string[]
    setSelected: (selected: string[]) => void
}

// TimelinePicker と同じ構成: 選択済みchip + 「追加」chip→入力欄 + 候補のPopover(内部スクロール)
export const LanguagePicker = (props: Props) => {
    const { t, i18n } = useTranslation('', { keyPrefix: 'components.languagePicker' })
    const { hapticSelection } = useHaptics()
    const dropdownAnchor = useAnchor()
    const uiLanguage = i18n.resolvedLanguage ?? 'en'

    const [focused, setFocused] = useState(false)
    const [focusedIdx, setFocusedIdx] = useState<number>(0)

    const [filter, setFilter] = useState('')

    const inputRef = useRef<HTMLInputElement>(null)

    const options = useMemo(() => {
        const remains = candidateLanguages.filter((c) => !props.selected.includes(c))
        if (filter === '') return remains
        const f = filter.toLowerCase()
        return remains.filter((c) => c.includes(f) || languageName(c, uiLanguage).toLowerCase().includes(f))
    }, [props.selected, filter, uiLanguage])

    return (
        <div
            style={
                {
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    position: 'relative',
                    alignItems: 'center',
                    anchorName: dropdownAnchor
                } as React.CSSProperties
            }
        >
            {props.selected.map((sel) => (
                <Chip
                    key={sel}
                    tailElement={
                        <IoMdCloseCircle
                            size={16}
                            onClick={() => {
                                props.setSelected(props.selected.filter((s) => s !== sel))
                            }}
                        />
                    }
                >
                    {languageName(sel, uiLanguage)}
                </Chip>
            ))}
            {focused ? (
                <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    style={{
                        flex: '1',
                        border: 'none',
                        outline: 'none',
                        padding: '8px',
                        borderRadius: '4px',
                        background: 'transparent'
                    }}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false)
                        setFilter('')
                        setFocusedIdx(0)
                    }}
                    onKeyDown={(e) => {
                        switch (e.key) {
                            case 'Escape':
                                inputRef.current?.blur()
                                break
                            case 'Enter':
                                if (options.length > 0 && focusedIdx >= 0 && focusedIdx < options.length) {
                                    props.setSelected([...props.selected, options[focusedIdx]])
                                    inputRef.current?.blur()
                                }
                                break
                            case 'ArrowDown':
                                e.preventDefault()
                                setFocusedIdx((prev) => (prev + 1) % options.length)
                                break
                            case 'ArrowUp':
                                e.preventDefault()
                                setFocusedIdx((prev) => (prev - 1 + options.length) % options.length)
                                break
                        }
                    }}
                />
            ) : (
                <Chip
                    variant="outlined"
                    onClick={() => {
                        hapticSelection()
                        setFocused(true)
                    }}
                    style={{
                        color: CssVar.divider
                    }}
                    tailElement={<IoMdAdd size={16} />}
                >
                    {t('addLanguage')}
                </Chip>
            )}
            {/* 開閉はinputのfocus/blurが真実の源泉なのでlight dismissのないmanualにする(onCloseは発火しない) */}
            <Popover
                open={focused && options.length > 0}
                onClose={() => {}}
                mode="manual"
                anchor={dropdownAnchor}
                style={{
                    width: 'anchor-size(width)',
                    padding: 0,
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    // 候補が多くても画面からはみ出さないように内部スクロールにする
                    maxHeight: 'min(40vh, 300px)',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain'
                }}
            >
                {options.map((opt) => (
                    <div
                        key={opt}
                        ref={(el) => {
                            if (focusedIdx === options.indexOf(opt)) el?.scrollIntoView({ block: 'nearest' })
                        }}
                        style={{
                            padding: '8px',
                            cursor: 'pointer',
                            borderBottom: `1px solid ${CssVar.divider}`,
                            backgroundColor: focusedIdx === options.indexOf(opt) ? CssVar.divider : 'transparent'
                        }}
                        onMouseDown={() => {
                            props.setSelected([...props.selected, opt])
                        }}
                    >
                        {languageName(opt, uiLanguage)}
                    </div>
                ))}
            </Popover>
        </div>
    )
}
