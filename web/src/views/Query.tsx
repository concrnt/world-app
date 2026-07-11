import { TextField, Button } from '@concrnt/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../types/Theme'
import { useNavigate } from 'react-router-dom'
import { View } from '../components/View'
import { Header } from '../components/Header'

export const QueryView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.query' })
    const navigate = useNavigate()

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
                        navigate('/timeline/' + encodeURIComponent(query))
                    }}
                >
                    {t('submit')}
                </Button>
            </div>
        </View>
    )
}
