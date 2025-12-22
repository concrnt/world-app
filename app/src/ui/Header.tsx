import { ReactNode } from "react";

interface Props {
    children?: ReactNode;
    left?: ReactNode;
    right?: ReactNode;
}

export const Header = (props: Props) => {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px",
                backgroundColor: "#E227A8",
            }}
        >
            <div
                style={{
                    height: "40px",
                    width: "40px",
                }}
            >
                {props.left}
            </div>
            {props.children}
            <div
                style={{
                    height: "40px",
                    width: "40px",
                }}
            >
                {props.right}
            </div>
        </div>
    );
}
