import { CssVar } from '../types/Theme'

interface Props {
    autofocus?: boolean
    value?: string
    placeholder?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const TextField = (props: Props) => {
    return (
        <input
            type="text"
            autoFocus={props.autofocus}
            value={props.value}
            placeholder={props.placeholder}
            onChange={props.onChange}
            style={{
                padding: '8px',
                fontSize: '16px',
                borderRadius: '4px',
                border: `1px solid ${CssVar.divider}`,
                backgroundColor: CssVar.contentBackground,
                color: CssVar.contentText,
                width: '100%',

                boxShadow: 'none',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none'
            }}
        />
    )
}
