import { ReactNode } from "react";

interface Props {
    onClick?: () => void;
    children: ReactNode;
    variant?: "contained" | "outlined" | "text";
}

export const Button = (props: Props) => {

    switch (props.variant) {
        case "outlined":
            return (
                <button
                    onClick={props.onClick}
                    style={{
                        backgroundColor: "transparent",
                        border: "2px solid #E227A8",
                        color: "#E227A8",
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
        case "text":
            return (
                <button
                    onClick={props.onClick}
                    style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#E227A8",
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
        case "contained":
        default:
            return (
                <button
                    onClick={props.onClick}
                    style={{
                        backgroundColor: "#E227A8",
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

}

