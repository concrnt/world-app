import { useState } from "react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { useClient } from "../contexts/Client";
import { AnimatePresence, motion } from 'motion/react';

interface Props {
    onClose?: () => void;
}

export const Composer = (props: Props) => {

    const { client } = useClient()
    const [willClose, setWillClose] = useState<boolean>(false);
    const [draft, setDraft] = useState<string>("");

    return <AnimatePresence
        onExitComplete={() => {
            setDraft("");
            props.onClose?.();
        }}
    >
        {!willClose &&
    <motion.div
        style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#fff',
            position: 'absolute',
            left: 0,
            zIndex: 1001,
        }}
        initial={{ top: '100%' }}
        animate={{ top: 0 }}
        exit={{ top: '100%' }}
        transition={{ duration: 0.1 }}
    >
        <div>
            <Button
                variant="text"
                onClick={() => {
                    setWillClose(true);
                }}
            >
                cancel
            </Button>
        </div>
        <div>
            <TextField
                autofocus
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
                        setWillClose(true);
                    })
                }}
            >
                投稿
            </Button>
        </div>
    </motion.div>}
    </AnimatePresence>
}

