interface Props {
    style?: React.CSSProperties
}

export const Divider = (props: Props) => {
    return (
        <hr
            style={{
                border: 'none',
                borderTop: '1px solid #e0e0e0',
                ...props.style
            }}
        />
    )
}
