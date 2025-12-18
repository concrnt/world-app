import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClient } from "./contexts/Client";

function App() {

    const client = useClient();

    const [authState, setAuthState] = useState("");
    const [secret, setSecret] = useState("");
    const [revealed, setRevealed] = useState("");

    return (
        <main className="container">

            <p>Client Status: {client.uninitialized ? "Uninitialized" : "Initialized"}</p>
            <pre>
                {JSON.stringify(client, null, 2)}
            </pre>

            <hr/>
            <p>Authentication State: {authState}</p>
            <button onClick={async () => {
                const state = await invoke<string>("auth_available");
                setAuthState(state);
            }}>Get Auth State</button>

            <hr />

            <form
                className="row"
                onSubmit={async (e) => {
                e.preventDefault();
                const result = await invoke<string>("save_key", {key: "my_key", "value": secret});
                setRevealed(result);
                }}
            >
                <input
                id="secret-input"
                onChange={(e) => setSecret(e.currentTarget.value)}
                placeholder="Enter a secret..."
                />
                <button type="submit">Save Secret</button>
            </form>

            <hr />

            <button onClick={async () => {
                const secret = await invoke<string>("get_key", {key: "my_key"});
                setRevealed(secret);
            }}>Reveal Secret</button>

            <p>Revealed Secret: {revealed}</p>

        </main>
    );
}

export default App;
