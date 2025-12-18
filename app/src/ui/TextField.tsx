
interface Props {
    value?: string;
    placeholder?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const TextField = (props: Props) => {
    return (
        <input
            type="text"
            value={props.value}
            placeholder={props.placeholder}
            onChange={props.onChange}
            style={{
                padding: "8px",
                fontSize: "16px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                width: "100%",
                boxSizing: "border-box",
            }}
        />
    );
}
