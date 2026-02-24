interface Props {
    checked: boolean
    onChange: (value: boolean) => void
}

export const Switch = (props: Props) => {
    return (
        <button
            onClick={() => props.onChange(!props.checked)}
            style={{
                padding: '10px 20px',
                backgroundColor: props.checked ? 'green' : 'red',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
            }}
        >
            {props.checked ? 'ON' : 'OFF'}
        </button>
    )
}
