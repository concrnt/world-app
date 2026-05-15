import { CssVar } from '@concrnt/ui'
import type { WidgetProps } from '@rjsf/utils'

export const TextWidget = (props: WidgetProps) => {
    const { id, value, required, disabled, readonly, autofocus, placeholder, onChange, onBlur, onFocus, options } =
        props
    const inputType = (options.inputType as string | undefined) ?? 'text'

    return (
        <input
            id={id}
            type={inputType}
            autoFocus={autofocus}
            required={required}
            disabled={disabled || readonly}
            placeholder={placeholder}
            value={typeof value === 'string' ? value : (value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onBlur(id, e.target.value)}
            onFocus={(e) => onFocus(id, e.target.value)}
            style={{
                padding: '8px',
                fontSize: '16px',
                borderRadius: '4px',
                borderColor: CssVar.divider,
                backgroundColor: CssVar.contentBackground,
                color: CssVar.contentText,
                width: '100%',
                boxSizing: 'border-box',
                boxShadow: 'none',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none'
            }}
        />
    )
}
