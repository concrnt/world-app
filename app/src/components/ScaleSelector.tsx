import { useTheme } from '../contexts/Theme'

interface Props {
    options: string[]
    value: string
    onChange: (value: string) => void
}

export const ScaleSelector = (props: Props) => {
    const theme = useTheme()

    return (
        <div
            style={{
                display: 'flex',
                gap: 'var(--space-1)'
            }}
        >
            {props.options.map((option) => (
                <button
                    key={option}
                    onClick={() => props.onChange(option)}
                    style={{
                        padding: 'var(--space-1) var(--space-2)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: props.value === option ? theme.ui.background : 'transparent',
                        color: props.value === option ? theme.ui.text : theme.content.text,
                        fontSize: '1em',
                        cursor: 'pointer',
                        fontWeight: props.value === option ? 'bold' : 'normal',
                        textTransform: 'uppercase'
                    }}
                >
                    {option}
                </button>
            ))}
        </div>
    )
}
