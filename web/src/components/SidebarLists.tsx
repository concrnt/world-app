import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'

import { CCImage, List as ListView, ListItem, Skeleton, Text } from '@concrnt/ui'
import { MdAlternateEmail, MdExpandMore, MdHelpOutline, MdOutlineTag } from 'react-icons/md'
import {
    type List,
    type ListEntry,
    PinnedListItemClass,
    type ProfileSchema,
    Schemas,
    semantics
} from '@concrnt/worldlib'

import { useClient } from '../contexts/Client'
import { useSubscribe } from '../hooks/useSubscribe'
import { useResource } from '../hooks/useResource'
import { usePreference } from '../contexts/Preference'
import { sortByListOrder } from '../utils/listOrder'
import { CssVar } from '../types/Theme'
import styles from './SidebarLists.module.css'

export const SidebarLists = () => {
    return (
        <div
            className={styles.scroll}
            style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto'
            }}
        >
            <ErrorBoundary fallbackRender={() => null}>
                <Suspense>
                    <Inner />
                </Suspense>
            </ErrorBoundary>
        </div>
    )
}

const Inner = () => {
    const { client } = useClient()

    const [pinnedLists] = useSubscribe(client.pinnedLists)
    const [listOrder] = usePreference('listOrder')
    const [expandedLists, setExpandedLists] = usePreference('expandedLists')

    const order = listOrder?.[client.currentProfile] ?? []
    const sortedPins = sortByListOrder(pinnedLists, order)
    const expanded = expandedLists?.[client.currentProfile] ?? []

    const toggle = (uri: string) => {
        setExpandedLists((old) => {
            const current = old?.[client.currentProfile] ?? []
            const next = current.includes(uri) ? current.filter((u) => u !== uri) : [...current, uri]
            return { ...old, [client.currentProfile]: next }
        })
    }

    return (
        <ListView
            dense
            disablePadding
            style={{
                color: CssVar.backdropText
            }}
        >
            {sortedPins.map((pin) => (
                <PinnedListRow
                    key={pin.uri}
                    pin={pin}
                    open={expanded.includes(pin.uri)}
                    onToggle={() => toggle(pin.uri)}
                />
            ))}
        </ListView>
    )
}

const PinnedListRow = (props: { pin: PinnedListItemClass; open: boolean; onToggle: () => void }) => {
    return (
        <Suspense
            key={props.pin.uri}
            fallback={
                <ListItem dense>
                    <Skeleton height="1rem" width="5rem" />
                </ListItem>
            }
        >
            <PinnedListRowInner pin={props.pin} open={props.open} onToggle={props.onToggle} />
        </Suspense>
    )
}

const PinnedListRowInner = (props: { pin: PinnedListItemClass; open: boolean; onToggle: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'components.sidebar' })
    const navigate = useNavigate()
    const [list] = useSubscribe(props.pin.list)

    if (!list) {
        return (
            <ListItem
                dense
                disabled
                icon={<MdHelpOutline size={24} />}
                style={{
                    opacity: 0.6
                }}
            >
                <Text
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block'
                    }}
                >
                    {t('notFound')}
                </Text>
            </ListItem>
        )
    }

    return (
        <>
            <ListItem
                dense
                icon={
                    // ButtonBaseはpointerdownでsetPointerCaptureするため、内側のクリック領域は
                    // pointerdownの伝播を止めないとclickがbuttonへ再ターゲットされて発火しない
                    <div
                        className={styles.iconStack}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation()
                            props.onToggle()
                        }}
                    >
                        {list.iconURL ? (
                            <>
                                <span className={styles.fadeIcon}>
                                    <CCImage
                                        src={list.iconURL}
                                        maxHeight={128}
                                        alt={list.title}
                                        style={{
                                            height: '1.125rem'
                                        }}
                                    />
                                </span>
                                <MdExpandMore
                                    size={24}
                                    className={styles.fadeArrow}
                                    style={{
                                        transform: props.open ? 'rotate(0deg)' : 'rotate(-90deg)'
                                    }}
                                />
                            </>
                        ) : (
                            <MdExpandMore
                                size={24}
                                style={{
                                    transform: props.open ? 'rotate(0deg)' : 'rotate(-90deg)',
                                    transition: 'transform 0.2s'
                                }}
                            />
                        )}
                    </div>
                }
                onClick={() => navigate('/lists/' + encodeURIComponent(props.pin.uri))}
            >
                <Text
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block'
                    }}
                >
                    {list.title || 'No Name'}
                </Text>
            </ListItem>
            {props.open && (
                <Suspense
                    fallback={
                        <ListItem
                            dense
                            style={{
                                paddingLeft: CssVar.space(3)
                            }}
                        >
                            <Skeleton height="1rem" width="5rem" />
                        </ListItem>
                    }
                >
                    <SubItems list={list} />
                </Suspense>
            )}
        </>
    )
}

const SubItems = (props: { list: List }) => {
    const [entries] = useSubscribe(props.list.entries)

    const shown = entries.filter(
        (entry) =>
            entry.value?.href &&
            (entry.value.schema === Schemas.communityTimeline || entry.value.schema === Schemas.userTimeline)
    )

    return (
        <>
            {shown.map((entry) => (
                <SubItemRow key={entry.key} entry={entry} />
            ))}
        </>
    )
}

const SubItemRow = (props: { entry: ListEntry }) => {
    const isUser = props.entry.value.schema === Schemas.userTimeline
    const href: string = props.entry.value.href
    // cckv://<ccid>/concrnt.world/profiles/<profile>/home-timeline
    const ccid = href.split('/')[2]
    const profileName = href.split('/')[5]

    return (
        <Suspense
            fallback={
                <ListItem
                    dense
                    style={{
                        paddingLeft: CssVar.space(3)
                    }}
                >
                    <Skeleton height="1rem" width="5rem" />
                </ListItem>
            }
        >
            <SubItemRowInner isUser={isUser} ccid={ccid} profileName={profileName} href={href} />
        </Suspense>
    )
}

const SubItemRowInner = (props: { isUser: boolean; ccid: string; profileName: string; href: string }) => {
    const { client } = useClient()
    const { t } = useTranslation('', { keyPrefix: 'components.sidebar' })
    const navigate = useNavigate()

    const label = useResource<string | null>(
        `sidebar-list-label:${client.api.defaultHost}:${client.ccid}:${props.isUser ? 'user' : 'timeline'}:${props.href}`,
        () => {
            if (props.isUser) {
                return Promise.all([
                    client.getUser(props.ccid),
                    client.api
                        .getDocument<ProfileSchema>(semantics.profile(props.ccid, props.profileName))
                        .catch(() => null)
                ])
                    .then(([user, doc]) => ({ ...user?.profile, ...doc?.value }).username ?? null)
                    .catch(() => null)
            }
            return client
                .getTimeline(props.href)
                .then((timeline) => (timeline ? (timeline.shortname ?? timeline.name ?? null) : null))
                .catch(() => null)
        }
    )

    return (
        <ListItem
            dense
            disabled={label === null}
            icon={
                label === null ? (
                    <MdHelpOutline size={18} />
                ) : props.isUser ? (
                    <MdAlternateEmail size={18} />
                ) : (
                    <MdOutlineTag size={18} />
                )
            }
            style={{
                paddingLeft: CssVar.space(3),
                opacity: label === null ? 0.6 : 1
            }}
            onClick={() =>
                navigate(props.isUser ? '/profile/' + props.ccid : '/timeline/' + encodeURIComponent(props.href))
            }
        >
            <Text
                style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block'
                }}
            >
                {label ?? t('notFound')}
            </Text>
        </ListItem>
    )
}
