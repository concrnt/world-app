import type { CSSProperties, ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import styles from './TextField.module.css'

interface Props {
    autofocus?: boolean
    disabled?: boolean
    value?: string
    placeholder?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
    // 枠の内側に置く装飾(先頭: アイコン等、末尾: クリアボタン等)
    startAdornment?: ReactNode
    endAdornment?: ReactNode
}

const frameStyle: CSSProperties = {
    // ToggleGroup と同じ高さに揃える
    minHeight: '40px',
    borderRadius: CssVar.round(1),
    backgroundColor: CssVar.contentBackground,
    color: CssVar.contentText,
    width: '100%',
    boxSizing: 'border-box'
}

const inputStyle: CSSProperties = {
    padding: '8px',
    fontSize: '16px',
    color: CssVar.contentText,
    width: '100%',

    boxShadow: 'none',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none'
}

export const TextField = (props: Props) => {
    const input = (
        <input
            type="text"
            className={props.startAdornment || props.endAdornment ? undefined : styles.frame}
            autoFocus={props.autofocus}
            disabled={props.disabled}
            value={props.value}
            placeholder={props.placeholder}
            onChange={props.onChange}
            onKeyDown={props.onKeyDown}
            onBlur={props.onBlur}
            style={
                props.startAdornment || props.endAdornment
                    ? {
                          ...inputStyle,
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          backgroundColor: 'transparent'
                      }
                    : { ...frameStyle, ...inputStyle }
            }
        />
    )

    if (!props.startAdornment && !props.endAdornment) return input

    // label で包むと装飾部分のクリックでも入力欄にフォーカスが移る(内側のボタンはボタン自身が受ける)
    return (
        <label
            className={styles.frame}
            style={{
                ...frameStyle,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: props.startAdornment ? '8px' : 0,
                paddingRight: props.endAdornment ? '2px' : 0
            }}
        >
            {props.startAdornment}
            {input}
            {props.endAdornment}
        </label>
    )
}
