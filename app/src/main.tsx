import ReactDOM from "react-dom/client";
import App from "./App";
import { ClientProvider } from "./contexts/Client";
import './index.css';

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <ClientProvider>
        <App />
    </ClientProvider>
);
