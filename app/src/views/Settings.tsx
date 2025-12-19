import { useState } from "react";
import { Text } from "../ui/Text";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { useClient } from "../contexts/Client";

export const SettingsView = () => {

    const { client } = useClient();

    const [username, setUsername] = useState("");
    const [avatar, setAvatar] = useState("");

    return (
        <div
            style={{
                width: '100vw',
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                backgroundColor: '#fff',
            }}
        >
            <Text>Settings</Text>
            <Text>Profile</Text>
            <TextField
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <TextField
                placeholder="Avatar URL"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
            />
            <Button
                onClick={() => {
                    if (!client) return;
                    const document = {
                        key: 'world.concrnt.profile',
                        schema: "https://schema.concrnt.world/p/main.json",
                        value: {
                            username,
                            avatar,
                        },
                        author: client.ccid,
                        createdAt: new Date(),
                    };
                    client.api.commit(document).then(() => {
                        console.log("Profile updated");
                    })
                }}
            >
                Save
            </Button>

        </div>
    )
}
