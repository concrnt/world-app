import { View } from '@concrnt/ui'
import { ApObject } from '../utils/activitypub'

interface Props {
    note: ApObject
}

export const ApNote = (props: Props) => {
    return <View>{props.note.content}</View>
}
