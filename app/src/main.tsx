import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ClientProvider } from "./contexts/Client";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <ClientProvider>
            <App />
        </ClientProvider>
    </React.StrictMode>,
);
