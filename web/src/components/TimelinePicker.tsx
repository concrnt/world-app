import { Chip } from '@concrnt/ui'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MdCheckCircle, MdHistory, MdOutlineTag } from 'react-icons/md'
import { IoMdCloseCircle } from 'react-icons/io'
import { IoMdAdd } from 'react-icons/io'

import { useClient } from '../contexts/Client'
import { Avatar, ListItem, Popover, Skeleton, useAnchor } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useHaptics } from '../contexts/Haptics'
import { useKeyboard } from '../contexts/Keyboard'
import { Select } from './Select'
import { ProfileName } from './ProfileName'
import { useResource } from '../hooks/useResource'
import { useTimelineSearch } from '../contexts/TimelineSearch'
import type { SearchHit, SearchProvider } from '../lib/timelineSearch'

interface Props {
    selected: string[]
    setSelected: (selected: string[]) => void
    // 候補の検索プロバイダー。省略時は TimelineSearch context(knownCommunities + crawler の合成)
    provider?: SearchProvider
    postHome?: boolean
    setPostHome?: (postHome: boolean) => void
    selectedProfile?: string
    setSelectedProfile?: (profile: string) => void
}

export const TimelinePicker = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.timelinePicker' })
    const { client } = useClient()
    const { hapticSelection } = useHaptics()
    const profileAnchor = useAnchor()
    const dropdownAnchor = useAnchor()
    const keyboard = useKeyboard()

    const [profileSelectOpen, setProfileSelectOpen] = useState(false)

    const [focused, setFocused] = useState(false)
    const [focusedIdx, setFocusedIdx] = useState<number>(0)

    const [filter, setFilter] = useState('')

    const inputRef = useRef<HTMLInputElement>(null)

    const contextProvider = useTimelineSearch()
    const provider = props.provider ?? contextProvider

    // プロバイダーから届いた最新の候補。known の結果は search() 内で同期的に届くので打鍵と同じレンダーで追従し、
    // crawler の結果やスナップショットの到着は後から同じコールバックで差し替わる(サスペンドしない)
    const [hits, setHits] = useState<SearchHit[]>([])
    // 一度でも見たヒット。選択済みchipのラベル/解決hintに使う(blurで候補が消えてもラベルを保つ)
    const seenRef = useRef(new Map<string, SearchHit>())

    useEffect(() => {
        const controller = new AbortController()
        provider.search(filter, controller.signal, (next) => {
            for (const hit of next) seenRef.current.set(hit.uri, hit)
            setHits(next)
        })
        return () => controller.abort()
    }, [provider, filter])

    const options = useMemo(() => hits.filter((hit) => !props.selected.includes(hit.uri)), [hits, props.selected])

    // 投稿元プロフィール（未指定時はクライアントのcurrentProfileにフォールバック）
    const activeProfile = props.selectedProfile ?? client?.currentProfile ?? 'main'
    const activeProfileDoc = client?.profiles?.[activeProfile]
    const profileAvatar = activeProfileDoc?.value.avatar ?? client?.profile.avatar
    const profileUsername = activeProfileDoc?.value.username ?? client?.profile.username ?? 'Home'

    return (
        <div
            style={
                {
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    position: 'relative',
                    alignItems: 'center',
                    anchorName: dropdownAnchor
                } as React.CSSProperties
            }
        >
            <Chip
                onClick={() => {
                    if (!props.setSelectedProfile) return
                    hapticSelection()
                    if (!client) return
                    setProfileSelectOpen(true)
                }}
                headElement={
                    <Avatar
                        ccid={client?.ccid ?? ''}
                        src={profileAvatar}
                        style={{
                            width: 20,
                            height: 20
                        }}
                    />
                }
                tailElement={
                    <IoMdCloseCircle
                        size={16}
                        style={{
                            transform: props.postHome === false ? 'rotate(45deg)' : 'none',
                            transition: 'transform 0.2s'
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            props.setPostHome?.(!props.postHome)
                        }}
                    />
                }
                style={
                    {
                        textDecoration: props.postHome === false ? 'line-through' : 'none',
                        opacity: props.postHome === false ? 0.5 : 1,
                        anchorName: profileAnchor
                    } as React.CSSProperties
                }
            >
                {profileUsername}
            </Chip>
            {props.selected.map((sel) => {
                const seen = seenRef.current.get(sel)
                return (
                    <Chip
                        key={sel}
                        headElement={<MdOutlineTag size={16} />}
                        tailElement={
                            <IoMdCloseCircle
                                size={16}
                                onClick={() => {
                                    props.setSelected(props.selected.filter((s) => s !== sel))
                                }}
                            />
                        }
                    >
                        {seen ? (
                            seen.name
                        ) : (
                            // リスト未登録のタイムラインを直接開いた時など、候補に無い投稿先も名前を解決してchipで見せる
                            <Suspense fallback={<Skeleton height="1em" width="3rem" />}>
                                <ResolvedTimelineName uri={sel} />
                            </Suspense>
                        )}
                    </Chip>
                )
            })}
            {focused ? (
                <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    style={{
                        flex: '1',
                        border: 'none',
                        outline: 'none',
                        padding: '8px',
                        borderRadius: '4px',
                        background: 'transparent'
                    }}
                    value={filter}
                    onChange={(e) => {
                        setFilter(e.target.value)
                        setFocusedIdx(0)
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false)
                        setFilter('')
                        setFocusedIdx(0)
                    }}
                    onKeyDown={(e) => {
                        switch (e.key) {
                            case 'Escape':
                                inputRef.current?.blur()
                                break
                            case 'Enter':
                                if (options.length > 0 && focusedIdx >= 0 && focusedIdx < options.length) {
                                    provider.remember?.(options[focusedIdx])
                                    props.setSelected([...props.selected, options[focusedIdx].uri])
                                    inputRef.current?.blur()
                                }
                                break
                            case 'ArrowDown':
                                e.preventDefault()
                                setFocusedIdx((prev) => (prev + 1) % options.length)
                                break
                            case 'ArrowUp':
                                e.preventDefault()
                                setFocusedIdx((prev) => (prev - 1 + options.length) % options.length)
                                break
                        }
                    }}
                />
            ) : (
                <Chip
                    variant="outlined"
                    onClick={() => {
                        hapticSelection()
                        setFocused(true)
                    }}
                    tailElement={<IoMdAdd size={16} />}
                >
                    {t('addDestination')}
                </Chip>
            )}
            {/* モーダル(Composer等)のoverflowにクリップされないよう、候補一覧はtop layerに出す。
                開閉はinputのfocus/blurが真実の源泉なのでlight dismissのないmanualにする(onCloseは発火しない) */}
            <Popover
                open={focused && options.length > 0}
                onClose={() => {}}
                mode="manual"
                anchor={dropdownAnchor}
                style={{
                    width: 'anchor-size(width)',
                    padding: 0,
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    // 候補が多くても投稿欄からはみ出さないように内部スクロールにする
                    maxHeight: 'min(40vh, 300px)',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    // ネイティブpopoverはソフトキーボードを知らないので、表示中に下へ開くと
                    // キーボードの裏に入る。入力欄の上側に開き、上に収まらなければflip-blockで下へ戻る
                    ...(keyboard.visible ? { top: 'auto', bottom: `calc(anchor(top) + ${CssVar.space(1)})` } : {})
                }}
            >
                {options.map((opt) => (
                    <div
                        key={opt.uri}
                        ref={(el) => {
                            // 内部スクロール化に伴い、キーボード選択中の候補が見切れないよう追従させる
                            if (focusedIdx === options.indexOf(opt)) el?.scrollIntoView({ block: 'nearest' })
                        }}
                        style={{
                            padding: '8px',
                            cursor: 'pointer',
                            borderBottom: `1px solid ${CssVar.divider}`,
                            backgroundColor: focusedIdx === options.indexOf(opt) ? CssVar.divider : 'transparent'
                        }}
                        onMouseDown={() => {
                            // 手動で選んだ候補だけを履歴に残す(プロバイダー側が履歴を持たなければ何もしない)
                            provider.remember?.(opt)
                            props.setSelected([...props.selected, opt.uri])
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {opt.name}
                            </span>
                            {/* 最近手動で選んだ候補は履歴アイコンで、どうして先頭に居るのかを示す */}
                            {opt.recent && <MdHistory size={14} style={{ opacity: 0.7, flexShrink: 0 }} />}
                            {/* リスト登録済みの候補は、ack済みユーザーと同じチェックマークで区別する */}
                            {opt.known && (
                                <MdCheckCircle
                                    size={14}
                                    style={{ opacity: 0.7, flexShrink: 0 }}
                                    title={t('inYourLists')}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </Popover>
            <Select
                open={profileSelectOpen}
                onClose={() => setProfileSelectOpen(false)}
                title={t('postProfile')}
                options={Object.entries(client?.profiles ?? {}).map(([key, profile]) => (
                    <ListItem
                        key={key}
                        icon={
                            <Avatar
                                ccid={profile.author}
                                src={profile.value.avatar}
                                style={{ width: '32px', height: '32px' }}
                            />
                        }
                        onClick={() => {
                            props.setSelectedProfile?.(key)
                            setProfileSelectOpen(false)
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: CssVar.space(2)
                            }}
                        >
                            <ProfileName document={profile} />
                        </div>
                    </ListItem>
                ))}
                anchor={profileAnchor}
            />
        </div>
    )
}

const ResolvedTimelineName = (props: { uri: string; hint?: string }) => {
    const { client } = useClient()
    const timeline = useResource(`timeline:${props.uri}`, () => client.getTimeline(props.uri, props.hint))
    return <>{timeline?.name ?? timeline?.shortname ?? props.uri}</>
}
