import { useTheme } from '../contexts/Theme'

interface Option {
    key: string
    label: string
}

interface Props {
    options: Option[]
    value: string
    onChange: (v: string) => void
}

export const ScaleSelector = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${props.options.length}, 1fr)`,
                gap: 'var(--space-1)',
                width: '100%'
            }}
        >
            {props.options.map((option) => {
                const selected = props.value === option.key
                return (
                    <button
                        key={option.key}
                        onClick={() => props.onChange(option.key)}
                        style={{
                            padding: 'var(--space-1)',
                            border: selected ? 'none' : `1px solid ${theme.divider}`,
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: selected ? theme.ui.background : 'transparent',
                            color: selected ? theme.ui.text : theme.content.text,
                            fontSize: 'var(--text-s)',
                            fontWeight: selected ? 'bold' : 'normal',
                            cursor: 'pointer',
                            minHeight: 'var(--hit-min)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
