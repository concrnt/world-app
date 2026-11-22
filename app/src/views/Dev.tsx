import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, TextField, View, Text, Divider, List, ListItem, Switch } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { UserPicker } from '../components/UserPicker'
import { useStack } from '../layouts/Stack'
import { StoreMockExplorerView, StoreMockHomeView, StoreMockIDView } from './StoreMocks'
import { InventoryView } from './Inventory'
import { MdBadge, MdChevronRight, MdExplore, MdHome, MdInventory2 } from 'react-icons/md'
import { usePreference } from '../contexts/Preference'
import { realtimeDiagnostics } from '@concrnt/client'

export const DevView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.dev' })
    const { client } = useClient()
    const stack = useStack()
    const [developerMode, setDeveloperMode] = usePreference('developerMode')

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
                    overflowY: 'auto',
                    touchAction: 'pan-y'
                }}
            >
                <List>
                    <ListItem secondaryAction={<Switch checked={developerMode} onChange={setDeveloperMode} />}>
                        {t('developerMode')}
                    </ListItem>
                    <ListItem
                        startIcon={<MdInventory2 size={24} />}
                        endIcon={<MdChevronRight size={24} />}
                        onClick={() => stack.push(<InventoryView />)}
                    >
                        {t('inventory')}
                    </ListItem>
                </List>

                <Divider />

                <UserPicker selected={selected} setSelected={setSelected} />

                <Divider />

                <Text variant="h3">Store Mock</Text>
                <Button startIcon={<MdHome />} onClick={() => stack.push(<StoreMockHomeView />)}>
                    {t('mockHome')}
                </Button>
                <Button startIcon={<MdExplore />} onClick={() => stack.push(<StoreMockExplorerView />)}>
                    {t('mockExplorer')}
                </Button>
                <Button startIcon={<MdBadge />} onClick={() => stack.push(<StoreMockIDView />)}>
                    {t('mockID')}
                </Button>

                <Divider />

                <Button
                    onClick={() => {
                        window.location.reload()
                    }}
                >
                    Reload
                </Button>

                <Divider />

                {/* 新着が止まった後でも経路のどこで途切れたか追えるよう、リアルタイム経路の状態と直近の異常を取り出す */}
                <Button
                    onClick={() => {
                        const diagnostics = JSON.stringify(realtimeDiagnostics(), null, 2)
                        setResult(diagnostics)
                        navigator.clipboard?.writeText(diagnostics).catch(() => {})
                    }}
                >
                    Copy realtime diagnostics
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
