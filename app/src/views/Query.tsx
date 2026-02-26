import { TextField, Button, View } from '@concrnt/ui'
import { TimelineView } from '../views/Timeline'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { useState } from 'react'
import { CssVar } from '../types/Theme'

export const QueryView = () => {
    const { push } = useStack()

    const [query, setQuery] = useState('')

    return (
        <View>
            <Header>照会</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2)
                }}
            >
                <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="cckv://" />
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
