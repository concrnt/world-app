import { ChunklineItem } from "@concrnt/client";
import { useEffect, useState } from "react";
import { useClient } from "../contexts/Client";
import { Divider } from "../ui/Divider";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";

export const HomeView = () => {

    const { client } = useClient();

    const [draft, setDraft] = useState<string>("");

    const [posts, setPosts] = useState<ChunklineItem[]>([]);

    const fetchPosts = async () => {
        if (!client) return;
        fetch(`http://cc2.tunnel.anthrotech.dev/api/v1/timeline/recent?uris=cc://${client.ccid}/world.concrnt.t-home`).then((response) => {
            response.json().then((data) => {
                if (!data || !Array.isArray(data)) return
                setPosts(data);
            })
        }).catch((error) => {
            console.error("Failed to fetch posts:", error);
        });
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    return (
        <div
            style={{
                width: '100vw',
                height: '100dvh',
                backgroundColor: '#fff',
            }}
        >
            Home View

            <Divider />

            <div
                style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}
            >
                <TextField
                    value={draft}
                    placeholder="いま、なにしてる？"
                    onChange={(e) => setDraft(e.target.value)}
                />

                <Button
                    onClick={async () => {
                        if (!client) return;
                        const document = {
                            schema: "https://schema.concrnt.world/m/markdown.json",
                            value: {
                                "body": draft
                            },
                            author: client.ccid,
                            memberOf: [
                                `cc://${client.ccid}/world.concrnt.t-home`,
                            ],
                            createdAt: new Date(),
                        };
                        client.api.commit(document).then(() => {
                            setDraft("");
                            fetchPosts();
                        })
                    }}
                >
                    投稿
                </Button>
            </div>

            <Divider />

            {posts.map((item, index) => (
                <div key={index} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
                    <p>{JSON.stringify(item)}</p>
                </div>
            ))}

        </div>
    )
}

