import { ReactNode } from "react";

interface Props {
    onClick?: () => void;
    children: ReactNode;
}

export const Button = (props: Props) => {
    return (
        <button
            onClick={props.onClick}
            style={{
                backgroundColor: "#e42279",
                border: "none",
                color: "white",
                padding: "15px 32px",
                textAlign: "center",
                textDecoration: "none",
                display: "inline-block",
                fontSize: "16px",
                margin: "4px 2px",
            }}
        >
            {props.children}
        </button>
    );
}

