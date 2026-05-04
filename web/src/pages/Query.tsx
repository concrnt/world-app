import { useState } from 'react'
import { Button, CssVar, Text, TextField, View } from '@concrnt/ui'
import { useNavigate } from 'react-router-dom'
import { Header } from '../ui/Header'

export const Query = () => {
    const navigate = useNavigate()
    const [query, setQuery] = useState('')

    return (
        <View
            style={{
                margin: 0,
                height: '100%',
                minHeight: 0
            }}
        >
            <Header>Query</Header>
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <Text>タイムライン URI を入力すると、そのまま Web の route で開きます。</Text>
                <TextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="cckv://" />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        disabled={!query.trim()}
                        onClick={() => navigate(`/timeline/${encodeURIComponent(query.trim())}`)}
                    >
                        Open Timeline
                    </Button>
                </div>
            </div>
        </View>
    )
}
