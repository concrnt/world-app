import { useState } from 'react'
import { Button, TextField, Text, Divider, List, ListItem, Switch } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { UserPicker } from '../components/UserPicker'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { usePersistent } from '../hooks/usePersistent'

export const DevView = () => {
    const { client } = useClient()
    const [developerMode, setDeveloperMode] = usePersistent('developer-mode', false)

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
                <List>
                    <ListItem secondaryAction={<Switch checked={developerMode} onChange={setDeveloperMode} />}>
                        開発者モード
                    </ListItem>
                </List>

                <Divider />

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
