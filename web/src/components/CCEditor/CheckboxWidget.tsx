import { CssVar, Text } from '@concrnt/ui'
import type { WidgetProps } from '@rjsf/utils'

export const CheckboxWidget = (props: WidgetProps) => {
    const { id, value, disabled, readonly, label, onChange, onBlur, onFocus } = props

    console.log('CheckboxWidgetProps', props)

    return (
        <label
            htmlFor={id}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(2)
            }}
        >
            <input
                id={id}
                type="checkbox"
                checked={Boolean(value)}
                disabled={disabled || readonly}
                onChange={(e) => onChange(e.target.checked)}
                onBlur={(e) => onBlur(id, e.target.checked)}
                onFocus={(e) => onFocus(id, e.target.checked)}
            />
            <Text>{label}</Text>
        </label>
    )
}
