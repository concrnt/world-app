import { Document } from '@concrnt/client'
import { CommunityTimelineSchema } from '@concrnt/worldlib'
import { CCWallpaper, Text, IconButton } from '@concrnt/ui'

import { MdPlaylistAdd } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { TimelineView } from '../views/Timeline'
import { Drawer } from '../ui/Drawer'
import { useState } from 'react'
import { Subscription } from './Subscription'
import { useMediaProxy } from '../contexts/MediaProxy'

interface Props {
    uri: string
    document: Document<CommunityTimelineSchema>
}

export const TimelineCard = (props: Props) => {
    const { getImageURL } = useMediaProxy()
    const { push } = useStack()

    const [subscriptionOpen, setSubscriptionOpen] = useState(false)

    return (
        <div
            style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                display: 'flex',
                overflow: 'hidden',
                height: '7rem',
                minHeight: '7rem'
            }}
        >
            <CCWallpaper
                style={{
                    height: '100%',
                    aspectRatio: '1/1'
                }}
                src={getImageURL(props.document.value.banner)}
            />
            <div
                style={{
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1
                }}
                onClick={(e) => {
                    e.stopPropagation()
                    push(<TimelineView uri={props.uri} />)
                }}
            >
                <Text variant="h4">{props.document.value.name}</Text>
                <Text>{props.document.value.description}</Text>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            setSubscriptionOpen(true)
                        }}
                    >
                        <MdPlaylistAdd size={24} />
                    </IconButton>
                    <Drawer open={subscriptionOpen} onClose={() => setSubscriptionOpen(false)}>
                        <Subscription target={props.uri} />
                    </Drawer>
                </div>
            </div>
        </div>
    )
}
