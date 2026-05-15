import { CssVar } from '@concrnt/ui'
import type { WidgetProps } from '@rjsf/utils'

export const SelectWidget = (props: WidgetProps) => {
    const { id, value, required, disabled, readonly, placeholder, onChange, onBlur, onFocus, options } = props

    return (
        <select
            id={id}
            required={required}
            disabled={disabled || readonly}
            value={value ?? ''}
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
                boxSizing: 'border-box'
            }}
        >
            <option value="" disabled>
                {placeholder ?? '選択してください'}
            </option>
            {Array.isArray(options.enumOptions) &&
                options.enumOptions.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                        {option.label}
                    </option>
                ))}
        </select>
    )
}
