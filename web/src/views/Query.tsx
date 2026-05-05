import { TextField, Button, View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { useState } from 'react'
import { CssVar } from '../types/Theme'
import { useNavigate } from 'react-router-dom'

export const QueryView = () => {
    const navigate = useNavigate()

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
                        navigate('/timeline/' + encodeURIComponent(query))
                    }}
                >
                    照会
                </Button>
            </div>
        </View>
    )
}
