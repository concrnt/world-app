import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, IconButton, TextField } from '@concrnt/ui'
import { MdAlternateEmail, MdClear, MdOutlineHome, MdOutlineTag, MdSearch } from 'react-icons/md'
import { IoIosCloseCircle } from 'react-icons/io'
import { useClient } from '../contexts/Client'
import { useResource } from '../hooks/useResource'
import { parseSearchQuery, type SearchFilter } from '../lib/searchQuery'

interface Props {
    filters: SearchFilter[]
    text: string
    // フィルターが効くタブ(投稿)かどうか。効かないタブではチップを薄く見せる
    filtersActive: boolean
    placeholder?: string
    onTextChange: (text: string) => void
    onFiltersChange: (filters: SearchFilter[]) => void
    onSubmit: () => void
    onBlur: () => void
    onClear: () => void
}

// in:/author: フィルターをチップとして見せる検索欄。生の cckv:// を入力欄に出さない。
// 入力中に「in:cckv://… 」のように空白で区切られたトークンはその場でチップに変換する
export const SearchQueryField = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.searchExplorer' })

    const removeFilter = (index: number) => {
        props.onFiltersChange(props.filters.filter((_, i) => i !== index))
    }

    // 入力値に含まれるフィルタートークンをチップへ移す。本文→フィルターの順に通知する
    // (親はフィルター変更時に最新の本文と合成して即検索するため、先に本文を更新しておく必要がある)
    const extractFilters = (value: string) => {
        const parsed = parseSearchQuery(value)
        if (parsed.filters.length === 0) {
            props.onTextChange(value)
            return
        }
        const merged = [...props.filters]
        for (const f of parsed.filters) {
            if (!merged.some((m) => m.kind === f.kind && m.value === f.value)) merged.push(f)
        }
        props.onTextChange(parsed.text)
        props.onFiltersChange(merged)
    }

    return (
        <TextField
            value={props.text}
            placeholder={props.placeholder}
            startAdornment={
                <>
                    <MdSearch size={20} style={{ opacity: 0.5, flexShrink: 0 }} />
                    {props.filters.length > 0 && (
                        // チップ列は横に伸びすぎないよう縮め、入力欄の幅を残す
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginLeft: '6px',
                                flexShrink: 1,
                                minWidth: 0,
                                maxWidth: '70%',
                                overflowX: 'auto',
                                scrollbarWidth: 'none'
                            }}
                        >
                            {props.filters.map((filter, index) => (
                                <FilterChip
                                    key={`${filter.kind}:${filter.value}`}
                                    filter={filter}
                                    active={props.filtersActive}
                                    removeTitle={t('removeFilter')}
                                    onRemove={() => removeFilter(index)}
                                />
                            ))}
                        </div>
                    )}
                </>
            }
            endAdornment={
                props.text || props.filters.length > 0 ? (
                    <IconButton onClick={props.onClear} title={t('clearSearch')}>
                        <MdClear size={20} />
                    </IconButton>
                ) : undefined
            }
            onChange={(e) => {
                const value = e.target.value
                // 変換中に値を書き換えるとIMEが崩れる。キャレットが末尾で空白を打った時だけチップ化する
                const composing = (e.nativeEvent as InputEvent).isComposing
                const atEnd = e.target.selectionStart === value.length
                if (!composing && atEnd && /\s$/.test(value)) {
                    extractFilters(value)
                    return
                }
                props.onTextChange(value)
            }}
            onBlur={props.onBlur}
            onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Backspace' && props.text === '' && props.filters.length > 0) {
                    e.preventDefault()
                    removeFilter(props.filters.length - 1)
                    return
                }
                if (e.key !== 'Enter') return
                // Enter で確定。書きかけのフィルターがあればチップに変換してから検索する
                extractFilters(props.text)
                props.onSubmit()
                e.currentTarget.blur()
            }}
        />
    )
}

interface ChipProps {
    filter: SearchFilter
    active: boolean
    removeTitle: string
    onRemove: () => void
}

// ホームタイムライン(cckv://<ccid>/concrnt.world/profiles/<profile>/home-timeline)は名前を持たないので、持ち主の名前で見せる
const HOME_TIMELINE = /^cckv:\/\/([^/]+)\/concrnt\.world\/profiles\/([^/]+)\/home-timeline$/

const FilterChip = (props: ChipProps) => {
    const home = props.filter.kind === 'in' ? HOME_TIMELINE.exec(props.filter.value) : null
    const icon =
        props.filter.kind === 'author' ? (
            <MdAlternateEmail size={16} />
        ) : home ? (
            <MdOutlineHome size={16} />
        ) : (
            <MdOutlineTag size={16} />
        )
    const fallback = <ChipLabel>{shortenValue(home ? home[1] : props.filter.value)}</ChipLabel>
    return (
        <Chip
            headElement={icon}
            tailElement={
                <IoIosCloseCircle
                    size={16}
                    title={props.removeTitle}
                    style={{ cursor: 'pointer', opacity: 0.6 }}
                    // 押下でボタンへフォーカスが移ると入力欄が blur して一覧に戻ってしまうので防ぐ(click は発火する)
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                        e.stopPropagation()
                        props.onRemove()
                    }}
                />
            }
            style={{ flexShrink: 1, minWidth: 0, opacity: props.active ? 1 : 0.5 }}
        >
            <Suspense fallback={fallback}>
                {props.filter.kind === 'author' ? (
                    <UserLabel ccid={props.filter.value} />
                ) : home ? (
                    <UserLabel ccid={home[1]} suffix={home[2] !== 'main' ? '/' + home[2] : ''} />
                ) : (
                    <TimelineLabel uri={props.filter.value} />
                )}
            </Suspense>
        </Chip>
    )
}

// Chip の中央 div は minWidth:0 を持たないので、省略記号はこの span 側で効かせる
const ChipLabel = (props: { children: React.ReactNode }) => (
    <span
        style={{
            display: 'block',
            maxWidth: '10em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '14px'
        }}
    >
        {props.children}
    </span>
)

// 名前が引けないときの表示。cckv の末尾セグメント / CCID の先頭だけ
const shortenValue = (value: string): string => {
    const trimmed = value.replace(/\/+$/, '')
    const last = trimmed.slice(trimmed.lastIndexOf('/') + 1)
    return last.length > 16 ? last.slice(0, 16) + '…' : last
}

// TimelinePicker の `timeline:` キーとは別にする(こちらは失敗を null に畳む)
const TimelineLabel = (props: { uri: string }) => {
    const { client } = useClient()
    const timeline = useResource(`search-chip-timeline:${props.uri}`, () =>
        client.getTimeline(props.uri).catch(() => null)
    )
    return <ChipLabel>{timeline?.name?.trim() || timeline?.shortname?.trim() || shortenValue(props.uri)}</ChipLabel>
}

const UserLabel = (props: { ccid: string; suffix?: string }) => {
    const { client } = useClient()
    const user = useResource(`search-chip-user:${props.ccid}`, () => client.getUser(props.ccid).catch(() => null))
    return <ChipLabel>{(user?.profile.username?.trim() || shortenValue(props.ccid)) + (props.suffix ?? '')}</ChipLabel>
}
