import { Document } from '@concrnt/client'
import { CommunityTimelineSchema } from '@concrnt/worldlib'
import { CCWallpaper, Text, IconButton } from '@concrnt/ui'

import { MdPlaylistAdd } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { TimelineView } from '../views/Timeline'
import { useDrawer } from '../contexts/Drawer'
import { Subscription } from './Subscription'

interface Props {
    uri: string
    document: Document<CommunityTimelineSchema>
}

export const TimelineCard = (props: Props) => {
    const { push } = useStack()

    const drawer = useDrawer()

    return (
        <div
            style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                display: 'flex',
                overflow: 'hidden',
                height: '7rem'
            }}
        >
            <CCWallpaper
                style={{
                    height: '100%',
                    aspectRatio: '1/1'
                }}
                src={props.document.value.banner}
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
                            drawer.open(<Subscription target={props.uri} />)
                        }}
                    >
                        <MdPlaylistAdd size={24} />
                    </IconButton>
                </div>
            </div>
        </div>
    )
}
