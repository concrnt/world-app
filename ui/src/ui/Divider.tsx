import { CssVar } from '../types/Theme'

interface Props {
    style?: React.CSSProperties
}

export const Divider = (props: Props) => {
    return (
        <hr
            style={{
                border: 'none',
                borderTop: `1px solid ${CssVar.divider}`,
                ...props.style
            }}
        />
    )
}
