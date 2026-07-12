import { TextField, Button, View } from '@concrnt/ui'
import { TimelineView } from '../views/Timeline'
import { Header } from '../ui/Header'
import { useStack } from '../layouts/Stack'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../types/Theme'

export const QueryView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.query' })
    const { push } = useStack()

    const [query, setQuery] = useState('')

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
                <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="cckv://" />
                <Button
                    onClick={() => {
                        push?.(<TimelineView uri={query} />)
                    }}
                >
                    {t('submit')}
                </Button>
            </div>
        </View>
    )
}
