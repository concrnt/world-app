import { CssVar } from '../types/Theme'

interface Props {
    autofocus?: boolean
    disabled?: boolean
    value?: string
    placeholder?: string
    rows?: number
    // JSONなどコード入力用
    monospace?: boolean
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export const TextArea = (props: Props) => {
    return (
        <textarea
            autoFocus={props.autofocus}
            disabled={props.disabled}
            value={props.value}
            placeholder={props.placeholder}
            rows={props.rows ?? 5}
            onChange={props.onChange}
            onKeyDown={props.onKeyDown}
            style={{
                padding: '8px',
                fontSize: '16px',
                fontFamily: props.monospace ? 'Source Code Pro, monospace' : 'inherit',
                borderRadius: '4px',
                border: `1px solid ${CssVar.divider}`,
                backgroundColor: CssVar.contentBackground,
                color: CssVar.contentText,
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',

                boxShadow: 'none',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none'
            }}
        />
    )
}
