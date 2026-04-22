import { Button } from "@concrnt/ui";
import { useState } from "react";
import { useClient } from "../contexts/Client";
import { Schemas, semantics } from "@concrnt/worldlib";

interface Props {
    additionalDestinations?: string[]
}

export const Composer = (props: Props) => {

    const { client } = useClient()
    const [draft, setDraft] = useState("");

    const handleSubmit = async () => {
        if (!client) return

        const homeTimeline = semantics.homeTimeline(client.ccid, client.currentProfile)
        const key = Date.now().toString()

        const distributes = [
            homeTimeline,
            ...(props.additionalDestinations || [])
        ]

        const document = {
            key: semantics.post(client.ccid, 'main', key),
            schema: Schemas.markdownMessage,
            value: {
                body: draft
            },
            author: client.ccid,
            distributes,
            createdAt: new Date()
        }
        await client.api.commit(document)

        setDraft("")

    }

    return <div>
        <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
                width: "100%",
            }}
        >
        </textarea>
        <div
            style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 8,
            }}
        >
            <Button
                onClick={() => {
                    handleSubmit()
                }}
            >Send</Button>
        </div>
    </div>

}


