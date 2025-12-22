import { ReactNode } from "react";
import { useTheme } from "../contexts/Theme";

interface Props {
    onClick?: () => void;
    children: ReactNode;
    variant?: "contained" | "outlined" | "text";
}

export const Button = (props: Props) => {

    const theme = useTheme();

    switch (props.variant) {
        case "outlined":
            return (
                <button
                    onClick={props.onClick}
                    style={{
                        backgroundColor: theme.ui.text,
                        border: `2px solid ${theme.ui.background}`,
                        color: theme.ui.background,
                        padding: "15px 32px",
                        textAlign: "center",
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
                        color: theme.content.link,
                        padding: "15px 32px",
                        textAlign: "center",
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
                        backgroundColor: theme.ui.background,
                        border: "none",
                        color: theme.ui.text,
                        padding: "15px 32px",
                        textAlign: "center",
                        fontSize: "16px",
                        margin: "4px 2px",
                    }}
                >
                    {props.children}
                </button>
            );
    }

}

