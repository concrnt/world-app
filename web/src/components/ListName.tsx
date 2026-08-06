import { Suspense } from 'react'
import { CCImage, Text } from '@concrnt/ui'
import { PinnedListItemClass } from '@concrnt/worldlib'
import { useSubscribe } from '../hooks/useSubscribe'

interface Props {
    pin: PinnedListItemClass
}

export const ListName = (props: Props) => {
    return (
        <Suspense key={props.pin.uri} fallback={<Text>Loading...</Text>}>
            <Inner pin={props.pin} />
        </Suspense>
    )
}

const Inner = ({ pin }: { pin: PinnedListItemClass }) => {
    const [list] = useSubscribe(pin.list)

    if (pin.isIconTab && list?.iconURL) {
        return (
            <CCImage
                src={list.iconURL}
                maxHeight={128}
                alt={list.title}
                style={{
                    height: '1.125rem'
                }}
            />
        )
    }

    return <Text>{list?.title ?? 'No Name'}</Text>
}
