import { View } from '@concrnt/ui'
import { Note } from '@fedify/vocab'

interface Props {
    note: Note
}

export const ApNote = (props: Props) => {
    return <View>{props.note.content}</View>
}
