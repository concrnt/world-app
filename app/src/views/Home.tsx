import { TimelineReader } from '@concrnt/client'
import { useEffect, useMemo } from 'react'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { MessageContainer } from '../components/message'
import { Header } from '../ui/Header'
import { useSidebar } from '../layouts/Sidebar'
import { View } from '../ui/View'

export const HomeView = () => {
    const { client } = useClient()

    const [reader, update] = useRefWithUpdate<TimelineReader | undefined>(undefined)

    const timelines = useMemo(() => [`cc://${client?.ccid}/world.concrnt.t-home`], [client])

    useEffect(() => {
        let isCancelled = false
        const request = async () => {
            if (!client) return

            return client.newTimelineReader().then((t) => {
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
    }, [client, reader, timelines, update])

    const { open } = useSidebar()

    return (
        <View>
            <Header
                left={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        onClick={() => open()}
                    >
                        🍔
                    </div>
                }
            >
                Home
            </Header>
            <div
                style={{
                    padding: '0 8px'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}
                >
                    {reader.current?.body.map((item) => (
                        <MessageContainer key={item.href} uri={item.href} />
                    ))}
                </div>
            </div>
        </View>
    )
}
