import { useState } from "react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { useClient } from "../contexts/Client";

interface Props {
    onClose?: () => void;
}

export const Composer = (props: Props) => {

    const { client } = useClient()

    const [draft, setDraft] = useState<string>("");

    return <div
        style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#fff',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1001,
        }}
    >
        <div>
            <Button
                variant="text"
                onClick={() => {
                    props.onClose?.();
                }}
            >
                cancel
            </Button>
        </div>
        <div>
            <TextField
                value={draft}
                placeholder="いま、なにしてる？"
                onChange={(e) => setDraft(e.target.value)}
            />
        </div>
        <div>
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
                        props.onClose?.();
                    })
                }}
            >
                投稿
            </Button>
        </div>
    </div>;
}

