import { TextField, Button, View, Text } from '@concrnt/ui'
import { TimelineView } from '../views/Timeline'
import { ProfileView } from '../views/Profile'
import { PostView } from '../views/Post'
import { ListView } from '../views/List'
import { ApView } from '../views/ApView'
import { BskyView } from '../views/BskyView'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { QueryResolveError, resolveQueryTarget } from '../lib/query'

interface Props {
    // ディープリンク等、外から照会文字列を持ち込むとき
    initialQuery?: string
    // マウント時にinitialQueryを即照会する(解決に失敗した理由をこの画面で見せるため)
    autoSubmit?: boolean
}

export const QueryView = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.query' })
    const { push } = useStack()
    const { client } = useClient()

    const [query, setQuery] = useState(props.initialQuery ?? '')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async (input: string) => {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            const target = await resolveQueryTarget(client, input)
            switch (target.kind) {
                case 'profile':
                    push?.(<ProfileView ccid={target.ccid} profileName={target.profileName} hint={target.hint} />)
                    break
                case 'post':
                    push?.(<PostView uri={target.uri} />)
                    break
                case 'timeline':
                    push?.(<TimelineView uri={target.uri} />)
                    break
                case 'list':
                    push?.(<ListView uri={target.uri} />)
                    break
                case 'apView':
                    push?.(<ApView uri={target.uri} />)
                    break
                case 'bskyView':
                    push?.(<BskyView uri={target.uri} />)
                    break
            }
        } catch (e) {
            setError(e instanceof QueryResolveError ? t(e.reason) : t('failed', { error: String(e) }))
        } finally {
            setBusy(false)
        }
    }

    useEffect(() => {
        if (props.autoSubmit && props.initialQuery) submit(props.initialQuery)
        // マウント時に一度だけ
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
                    placeholder="cckv:// / CCID / https://concrnt.world/..."
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
