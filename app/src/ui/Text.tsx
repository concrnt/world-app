import { ReactNode } from "react";

interface Props {
    children: ReactNode;
}

export const Text = (props: Props) => {
    return (
        <p
            style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}
        >
            {props.children}
        </p>
    );
}
