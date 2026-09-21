import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorBoundary } from 'react-error-boundary'
import { Button, ButtonBase, CopyButton, Divider, List, ListItem, Skeleton, Text, View } from '@concrnt/ui'
import { parseCCURI, type QueryItem } from '@concrnt/client'
import { semantics } from '@concrnt/worldlib'
import { MdChevronRight, MdDescription, MdFolder, MdHome } from 'react-icons/md'
import { CssVar } from '../types/Theme'
import { Header } from '../ui/Header'
import { useClient } from '../contexts/Client'
import { InventoryDetail } from '../components/InventoryDetail'
import { RenderError } from '../components/message/RenderError'

const PAGE_SIZE = 50

// 自分の名前空間をファイルエクスプローラーのように辿る画面。
// 現在のキーはこの画面内のstateで持ち、パスバーと一覧で上書きする
export const InventoryView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.inventory' })
    const { client } = useClient()

    const root = semantics.user(client.ccid)
    const [uri, setUri] = useState(root)
    const parsed = parseCCURI(uri)
    const segments = parsed.key === '' ? [] : parsed.key.split('/')

    const select = (next: string) => {
        setUri(next)
    }

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(1),
                        // スクロール親のflex子はmin-height:0で潰れるので固定。横スクロールバーは非表示
                        flexShrink: 0,
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        whiteSpace: 'nowrap',
                        padding: CssVar.space(1),
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: CssVar.round(1)
                    }}
                >
                    <ButtonBase
                        onClick={() => select(root)}
                        disabled={segments.length === 0}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(1),
                            padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                            borderRadius: CssVar.round(1),
                            color: 'inherit',
                            fontWeight: segments.length === 0 ? 'bold' : undefined
                        }}
                    >
                        <MdHome size={20} />
                        {t('root')}
                    </ButtonBase>
                    {segments.map((segment, index) => {
                        const isLast = index === segments.length - 1
                        const target = `cckv://${parsed.owner}/${segments.slice(0, index + 1).join('/')}`
                        return (
                            <div key={target} style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1) }}>
                                <MdChevronRight size={16} style={{ opacity: 0.6 }} />
                                <ButtonBase
                                    onClick={() => select(target)}
                                    disabled={isLast}
                                    style={{
                                        padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                                        borderRadius: CssVar.round(1),
                                        color: 'inherit',
                                        fontWeight: isLast ? 'bold' : undefined
                                    }}
                                >
                                    {segment}
                                </ButtonBase>
                            </div>
                        )
                    })}
                    <div style={{ marginLeft: 'auto', paddingLeft: CssVar.space(2) }}>
                        <CopyButton text={uri} size={18} />
                    </div>
                </div>
                <Text variant="caption" style={{ wordBreak: 'break-all' }}>
                    {uri}
                </Text>

                <ErrorBoundary FallbackComponent={RenderError}>
                    <InventoryDetail key={uri} uri={uri} />
                </ErrorBoundary>

                <Divider />

                <Text variant="h5">{t('children')}</Text>
                <InventoryChildren key={uri} uri={uri} onSelect={select} />
            </div>
        </View>
    )
}

// そのキーを直接親に持つドキュメント/中間キーの一覧(cckv順)。
// keyでuriごとに作り直されるので、状態のリセットは初期値で済む
const InventoryChildren = (props: { uri: string; onSelect: (uri: string) => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.inventory' })
    const { client } = useClient()

    const [items, setItems] = useState<QueryItem[]>([])
    const [next, setNext] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        client.api
            .query({ parent: props.uri, orderby: 'key', order: 'asc', limit: PAGE_SIZE })
            .then((page) => {
                if (cancelled) return
                setItems(page.items)
                setNext(page.next)
            })
            .catch((e) => {
                if (!cancelled) setError(String(e))
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [client, props.uri])

    const readMore = () => {
        if (!next || loading) return
        const cursor = next
        setLoading(true)
        // sinceは境界を含むので、前ページ末尾と重なる行はcckvで落とす
        client.api
            .query({ parent: props.uri, orderby: 'key', order: 'asc', limit: PAGE_SIZE, since: cursor })
            .then((page) => {
                setItems((prev) => {
                    const seen = new Set(prev.map((item) => item.cckv))
                    return [...prev, ...page.items.filter((item) => !seen.has(item.cckv))]
                })
                setNext(page.next === cursor ? null : page.next)
            })
            .catch((e) => {
                setError(String(e))
            })
            .finally(() => {
                setLoading(false)
            })
    }

    if (error) {
        return <Text style={{ color: 'red' }}>{t('loadFailed', { error })}</Text>
    }

    return (
        <>
            {items.length === 0 && !loading && <Text variant="caption">{t('empty')}</Text>}
            <List>
                {items.map((item) => {
                    const isDocument = 'document' in item
                    let schema = ''
                    if (isDocument) {
                        try {
                            schema = String(JSON.parse(item.document).schema ?? '')
                        } catch {
                            schema = ''
                        }
                    }
                    return (
                        <ListItem
                            key={item.cckv}
                            startIcon={isDocument ? <MdDescription size={24} /> : <MdFolder size={24} />}
                            endIcon={<MdChevronRight size={24} />}
                            onClick={() => props.onSelect(item.cckv)}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ wordBreak: 'break-all' }}>{item.cckv.split('/').pop()}</span>
                                {schema && (
                                    <Text variant="caption" style={{ wordBreak: 'break-all' }}>
                                        {schema.replace(/^https?:\/\/[^/]+\//, '')}
                                    </Text>
                                )}
                            </div>
                        </ListItem>
                    )
                })}
            </List>
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
                    <Skeleton height={40} />
                    <Skeleton height={40} />
                </div>
            )}
            {next && !loading && (
                <Button variant="outlined" onClick={readMore}>
                    {t('loadMore')}
                </Button>
            )}
        </>
    )
}
