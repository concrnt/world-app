interface Props {
    checked: boolean
    onChange: (value: boolean) => void
}

export const Switch = (props: Props) => {
    return (
        <button
            onClick={() => props.onChange(!props.checked)}
            style={{
                padding: 'var(--switch-pad-v) var(--switch-pad-h)',
                backgroundColor: props.checked ? 'green' : 'red',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
            }}
        >
            {props.checked ? 'ON' : 'OFF'}
        </button>
    )
}
