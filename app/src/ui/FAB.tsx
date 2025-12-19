import { ReactNode } from "react";

interface Props {
    onClick?: () => void;
    children: ReactNode;
}

export const FAB = (props: Props) => {

    return (
        <button
            onClick={props.onClick}
            style={{
                backgroundColor: "#E227A8",
                border: "none",
                color: "white",
                padding: "15px",
                borderRadius: "50%",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                cursor: "pointer",
                position: "fixed",
                width: "60px",
                height: "60px",
                bottom: "60px",
                right: "20px",
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
        >
            {props.children}
        </button>
    );

}

