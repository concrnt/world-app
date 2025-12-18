import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClient } from "./contexts/Client";
import { Button } from "./ui/Button";
import { TextField } from "./ui/TextField";
import { Text } from "./ui/Text";
import { Divider } from "./ui/Divider";

function App() {

    const client = useClient();

    const [authState, setAuthState] = useState("");
    const [secret, setSecret] = useState("");
    const [revealed, setRevealed] = useState("");

    return <div
        style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}
    >
        <Text>Client Status: {client.uninitialized ? "Uninitialized" : "Initialized"}</Text>

        <Divider />

        <Text>Authentication State: {authState}</Text>

        <Button onClick={async () => {
            const state = await invoke<string>("auth_available");
            setAuthState(state);
        }}>
            Get Auth State
        </Button>

        <Divider />

        <div
            style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}
        >
            <TextField
                value={secret}
                onChange={(e) => setSecret(e.currentTarget.value)}
                placeholder="Enter a secret..."
            />
            <Button
                onClick={async () => {
                    const result = await invoke<string>("save_key", {key: "my_key", "value": secret});
                    setRevealed(result);
                }}
            >
                Save Secret
            </Button>
        </div>

        <Divider />

        <Button onClick={async () => {
            const secret = await invoke<string>("get_key", {key: "my_key"});
            setRevealed(secret);
        }}>
            Reveal Secret
        </Button>

        <Text>Revealed Secret: {revealed}</Text>

    </div>;
}

export default App;
