import { CssVar } from '@concrnt/ui'
import type { WidgetProps } from '@rjsf/utils'

export const TextareaWidget = (props: WidgetProps) => {
    const { id, value, required, disabled, readonly, autofocus, placeholder, onChange, onBlur, onFocus } = props

    return (
        <textarea
            id={id}
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
                minHeight: 120,
                resize: 'vertical',
                boxSizing: 'border-box',
                boxShadow: 'none',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none'
            }}
        />
    )
}
