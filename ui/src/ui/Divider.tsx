import { CssVar } from '../types/Theme'

interface Props {
    style?: React.CSSProperties
    /** タイムラインのセル(左右padding: space*2)に揃えて、左右に隙間を空ける */
    inset?: boolean
}

export const Divider = (props: Props) => {
    return (
        <hr
            style={{
                border: 'none',
                borderTop: `1px solid ${CssVar.divider}`,
                ...(props.inset ? { marginInline: CssVar.space(2) } : {}),
                ...props.style
            }}
        />
    )
}
