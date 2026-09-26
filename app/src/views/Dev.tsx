import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, TextField, View, Text, Divider, List, ListItem, Switch } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { UserPicker } from '../components/UserPicker'
import { useStack } from '../layouts/Stack'
import { StoreMockExplorerView, StoreMockHomeView, StoreMockIDView } from './StoreMocks'
import { MdBadge, MdExplore, MdHome } from 'react-icons/md'
import { usePreference } from '../contexts/Preference'
import { getEthAddress, signEthMessage } from '../lib/eth'

export const DevView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.dev' })
    const { client } = useClient()
    const stack = useStack()
    const [developerMode, setDeveloperMode] = usePreference('developerMode')

    const [uriDraft, setURIDraft] = useState('')
    const [result, setResult] = useState<string>('')

    const [selected, setSelected] = useState<string[]>([])

    const [ethAddress, setEthAddress] = useState<string>('')
    const [ethMessage, setEthMessage] = useState('hello concrnt')
    const [ethSignature, setEthSignature] = useState<string>('')

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

                <Text variant="h3">Ethereum</Text>
                <Button
                    onClick={() => {
                        getEthAddress(client.ccid)
                            .then(setEthAddress)
                            .catch((e) => setEthAddress(`error: ${e}`))
                    }}
                >
                    Get ETH Address
                </Button>
                <Text style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{ethAddress}</Text>
                <TextField
                    value={ethMessage}
                    onChange={(e) => setEthMessage(e.target.value)}
                    placeholder="message to sign (EIP-191)"
                />
                <Button
                    onClick={() => {
                        signEthMessage(ethMessage, client.ccid)
                            .then(setEthSignature)
                            .catch((e) => setEthSignature(`error: ${e}`))
                    }}
                >
                    Sign Message (auth required)
                </Button>
                <Text style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{ethSignature}</Text>

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
