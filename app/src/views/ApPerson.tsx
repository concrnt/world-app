import { View } from '@concrnt/ui'
import { Person } from '@fedify/vocab'

interface Props {
    person: Person
}

export const ApPerson = (props: Props) => {
    return <View>{props.person.name}</View>
}
