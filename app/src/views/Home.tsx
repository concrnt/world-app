import { TimelineReader } from "@concrnt/client";
import { useEffect, useState } from "react";
import { useClient } from "../contexts/Client";
import { Divider } from "../ui/Divider";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { useRefWithUpdate } from "../hooks/useRefWithUpdate";

export const HomeView = () => {

    const { client } = useClient();

    const [draft, setDraft] = useState<string>("");

    const [reader, update] = useRefWithUpdate<TimelineReader | undefined>(undefined);

    const timelines = [`cc://${client?.ccid}/world.concrnt.t-home`];

    useEffect(() => {
        let isCancelled = false
        const request = async () => {
            if (!client) return

            return client
                .newTimelineReader()
                .then((t) => {
                    if (isCancelled) return
                    t.onUpdate = () => {
                        update()
                    }

                    reader.current = t
                    t.listen(timelines)
                    return t
                })
        }
        const mt = request()
        return () => {
            isCancelled = true
            mt.then((t) => {
                t?.dispose()
            })
        }
    }, [client]);


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
                            // fetchPosts();
                        })
                    }}
                >
                    投稿
                </Button>
            </div>

            <Divider />

            {reader.current?.body.map((item, index) => (
                <div key={index} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
                    <p>{JSON.stringify(item)}</p>
                </div>
            ))}

        </div>
    )
}

