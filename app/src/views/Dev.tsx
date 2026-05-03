import { useState } from 'react'
import { Button, TextField, View, Text, Divider } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { User } from '@concrnt/worldlib'
import { UserPicker } from '../components/UserPicker'

export const DevView = () => {
    const { client } = useClient()

    const [uriDraft, setURIDraft] = useState('')
    const [result, setResult] = useState<string>('')

    const [selected, setSelected] = useState<string[]>([])

    return (
        <View>
            <Header>Devtools</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2),
                    flex: 1,
                    overflowY: 'auto'
                }}
            >
                <UserPicker selected={selected} setSelected={setSelected} />

                <Divider />

                <Button
                    onClick={() => {
                        window.location.reload()
                    }}
                >
                    Reload
                </Button>

                <Divider />

                <Text variant="h3">Delete</Text>
                <TextField value={uriDraft} onChange={(e) => setURIDraft(e.target.value)} placeholder="URI to delete" />
                <Button
                    onClick={() => {
                        client.api.delete(uriDraft).then((res) => {
                            setResult(JSON.stringify(res, null, 2))
                        })
                    }}
                >
                    Delete
                </Button>

                <pre>{result}</pre>
            </div>
        </View>
    )
}
