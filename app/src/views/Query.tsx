import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { TimelineView } from '../views/Timeline'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { useState } from 'react'

export const QueryView = () => {
    const { push } = useStack()

    const [query, setQuery] = useState('')

    return (
        <View>
            <Header>照会</Header>
            <div>
                <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="cc://" />
                <Button
                    onClick={() => {
                        push?.(<TimelineView uri={query} />)
                    }}
                >
                    照会
                </Button>
            </div>
        </View>
    )
}
