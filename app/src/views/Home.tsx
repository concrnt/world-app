/* eslint-disable react-hooks/refs */

import { TimelineReader } from '@concrnt/client'
import { Fragment, Suspense, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useClient } from '../contexts/Client'
import { useRefWithUpdate } from '../hooks/useRefWithUpdate'
import { MessageContainer } from '../components/message'
import { Header } from '../ui/Header'
import { useSidebar } from '../layouts/Sidebar'
import { View } from '../ui/View'
import { Divider } from '../ui/Divider'
import { MdMenu } from 'react-icons/md'
import { ScrollViewProps } from '../types/ScrollView'

export const HomeView = (props: ScrollViewProps) => {
    const { client } = useClient()

    const [reader, update] = useRefWithUpdate<TimelineReader | undefined>(undefined)

    const timelines = useMemo(
        () => [`cc://${client?.ccid}/concrnt.world/main/home-timeline`, ...(client?.home?.items ?? [])],
        [client]
    )

    const scrollRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(props.ref, () => ({
        scrollToTop: () => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
    }))

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
                        <MdMenu size={24} />
                    </div>
                }
            >
                Home
            </Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    overflowY: 'auto'
                }}
                ref={scrollRef}
            >
                {reader.current?.body.map((item) => (
                    <Fragment key={item.href}>
                        <div style={{ padding: '0 8px' }}>
                            <Suspense fallback={<div>Loading...</div>}>
                                <MessageContainer uri={item.href} />
                            </Suspense>
                        </div>
                        <Divider />
                    </Fragment>
                ))}
            </div>
        </View>
    )
}
