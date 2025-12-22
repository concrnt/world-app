import ReactDOM from "react-dom/client";
import App from "./App";
import { ClientProvider } from "./contexts/Client";
import './index.css';
import { ThemeProvider } from "./contexts/Theme";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <ClientProvider>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </ClientProvider>
);
