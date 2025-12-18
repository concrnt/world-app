import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { Text } from "../ui/Text";
import { Divider } from "../ui/Divider";

export const WelcomeView = () => {

    const [authState, setAuthState] = useState("");
    const [secret, setSecret] = useState("");
    const [revealed, setRevealed] = useState("");

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
            }}
        >
            <Text>Welcome</Text>
            <Text>Authentication State: {authState}</Text>

            <Button onClick={async () => {
                const state = await invoke<string>("auth_available");
                setAuthState(state);
            }}>
                Get Auth State
            </Button>

            <Divider />
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
            <Divider />

            <Button onClick={async () => {
                const secret = await invoke<string>("get_key", {key: "my_key"});
                setRevealed(secret);
            }}>
                Reveal Secret
            </Button>

            <Text>Revealed Secret: {revealed}</Text>
        </div>
    )
}

