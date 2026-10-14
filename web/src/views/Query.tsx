import { TextField, Button, Text } from '@concrnt/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../types/Theme'
import { useNavigate } from 'react-router-dom'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { useClient } from '../contexts/Client'
import { QueryResolveError, resolveQueryTarget } from '../lib/query'

export const QueryView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.query' })
    const navigate = useNavigate()
    const { client } = useClient()

    const [query, setQuery] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async (input: string) => {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            const target = await resolveQueryTarget(client, input)
            switch (target.kind) {
                case 'profile': {
                    const path = '/profile/' + target.ccid + (target.profileName ? '/' + target.profileName : '')
                    navigate(target.hint ? `${path}?hint=${encodeURIComponent(target.hint)}` : path)
                    break
                }
                case 'post':
                    navigate('/post/' + encodeURIComponent(target.uri))
                    break
                case 'timeline':
                    navigate('/timeline/' + encodeURIComponent(target.uri))
                    break
                case 'list':
                    navigate('/lists/' + encodeURIComponent(target.uri))
                    break
            }
        } catch (e) {
            setError(e instanceof QueryResolveError ? t(e.reason) : t('failed', { error: String(e) }))
        } finally {
            setBusy(false)
        }
    }

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2)
                }}
            >
                <TextField
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(query)
                    }}
                    placeholder="cckv:// / CCID / https://.../manifest.json"
                />
                <Button disabled={busy} onClick={() => submit(query)}>
                    {busy ? t('resolving') : t('submit')}
                </Button>
                {error && (
                    <Text variant="caption" style={{ color: 'red', wordBreak: 'break-all' }}>
                        {error}
                    </Text>
                )}
            </div>
        </View>
    )
}
