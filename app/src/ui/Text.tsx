import { ReactNode } from "react";

interface Props {
    children: ReactNode;
}

export const Text = (props: Props) => {
    return (
        <p>{props.children}</p>
    );
}
