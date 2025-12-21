import { TimelineReader } from "@concrnt/client";
import { useEffect } from "react";
import { useClient } from "../contexts/Client";
import { useRefWithUpdate } from "../hooks/useRefWithUpdate";
import { MessageContainer } from "../components/message";
import { StackLayout } from "../layouts/StackLayout";

export const HomeView = () => {

    const { client } = useClient();


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
                width: '100%',
                height: '100%',
                backgroundColor: '#fff',
                padding: '8px',
                gap: '16px',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <StackLayout>
                <div
                    style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                    }}
                >
                    {reader.current?.body.map(item => (
                        <MessageContainer
                            key={item.href}
                            uri={item.href}
                        />
                    ))}
                </div>
            </StackLayout>
        </div>
    )
}
