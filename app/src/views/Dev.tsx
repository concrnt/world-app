import { useState } from 'react'
import { TimelinePicker } from '../components/TimelinePicker'
import { Text } from '../ui/Text'
import { View } from '../ui/View'

export const DevView = () => {
    const [selected, setSelected] = useState<string[]>(['1'])

    return (
        <View>
            <Text>Devtools</Text>
            <div>
                <TimelinePicker
                    items={[
                        { id: '1', label: 'Item 1' },
                        { id: '2', label: 'Item 2' },
                        { id: '3', label: 'Item 3' }
                    ]}
                    selected={selected}
                    setSelected={setSelected}
                    keyFunc={(item) => item.id}
                    labelFunc={(item) => item.label}
                />
            </div>
        </View>
    )
}
