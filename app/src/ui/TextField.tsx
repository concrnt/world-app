import { useTheme } from '../contexts/Theme'

interface Props {
    autofocus?: boolean
    value?: string
    placeholder?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const TextField = (props: Props) => {
    const theme = useTheme()

    return (
        <input
            type="text"
            autoFocus={props.autofocus}
            value={props.value}
            placeholder={props.placeholder}
            onChange={props.onChange}
            style={{
                padding: 'var(--space-2)',
                fontSize: '1em',
                borderRadius: 'var(--radius-sm)',
                borderColor: theme.divider,
                backgroundColor: theme.content.background,
                color: theme.content.text,
                width: '100%'
            }}
        />
    )
}
