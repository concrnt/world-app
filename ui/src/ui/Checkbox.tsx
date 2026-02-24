interface Props {
    checked: boolean
    onChange: (checked: boolean) => void
}

export const Checkbox = (props: Props) => {
    return <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
}
