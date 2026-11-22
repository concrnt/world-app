import { useTranslation } from 'react-i18next'
import { useClient } from '../../contexts/Client'
import { MessageProps } from './types'
import { RerouteMessageSchema } from '@concrnt/worldlib'

import { Avatar, Confirm, Text, IconButton, ListItem, useAnchor } from '@concrnt/ui'
import { CDID, parseCCURI } from '@concrnt/client'

import { useEffect, useState } from 'react'
import { MdMoreHoriz } from 'react-icons/md'
import { MdRepeat } from 'react-icons/md'
import { Select } from '../Select'
import { useHaptics } from '../../contexts/Haptics'
import { OnelineMessageLayout } from './OnelineLayout'
import { MessageContainer } from './main'
import { TimeDiff } from '../TimeDiff'
import { RenderError } from './RenderError'
import { ErrorBoundary } from 'react-error-boundary'
import { useNavigate } from 'react-router-dom'
import { useQueryTimelineContext } from '../QueryTimeline'

export const RerouteMessage = (props: MessageProps<RerouteMessageSchema>) => {
    const { t } = useTranslation('', { keyPrefix: 'components.rerouteMessage' })
    const { client } = useClient()
    const navigate = useNavigate()
    const { hapticSuccess } = useHaptics()
    const qt = useQueryTimelineContext()
    const menuAnchor = useAnchor()

    const [menuOpen, setMenuOpen] = useState(false)
    const [unpublishCandidates, setUnpublishCandidates] = useState<Array<{ uri: string; name: string }>>([])
    const [unpublishTarget, setUnpublishTarget] = useState<{ uri: string; name: string } | null>(null)

    // 他人のリルートでも外せるならメニューボタンを出すので、開く前に候補を求めておく
    // 外せるのは自分の名前空間のタイムラインか、moderationポリシーでモデレーターに指定されたもの
    useEffect(() => {
        Promise.all(
            (props.message.distributes ?? []).map(async (uri) => {
                const timeline = await client.getTimeline(uri)
                const moderators: string[] =
                    timeline?.policy?.entries?.find((e) => e.url === 'https://policy.concrnt.world/t/moderation.json')
                        ?.params?.moderators ?? []
                if (parseCCURI(uri).owner !== client.ccid && !moderators.includes(client.ccid)) return []
                // ホームタイムラインには名前が無い
                const name =
                    timeline?.shortname?.trim() ||
                    timeline?.name ||
                    (uri.endsWith('/home-timeline') ? t('homeTimeline') : uri)
                return [{ uri, name }]
            })
        ).then((candidates) => setUnpublishCandidates(candidates.flat()))
    }, [client, props.message, t])

    return (
        <div>
            <OnelineMessageLayout
                left={
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            opacity: 0.7
                        }}
                    >
                        <MdRepeat size={14} />
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                const link = props.message.value?.profileOverride?.link
                                if (link) {
                                    // ブリッジ経由(AP/Bluesky)のauthorはサービスアカウントなので、元ユーザーのプロフィールへ
                                    navigate(
                                        link.startsWith('https://bsky.app/profile/')
                                            ? '/bluesky/view/' +
                                                  encodeURIComponent(link.slice('https://bsky.app/profile/'.length))
                                            : '/activitypub/view/' + encodeURIComponent(link)
                                    )
                                } else {
                                    navigate(
                                        '/profile/' +
                                            props.message.author +
                                            (props.message.authorProfileName &&
                                            props.message.authorProfileName !== 'main'
                                                ? '/' + props.message.authorProfileName
                                                : '')
                                    )
                                }
                            }}
                            style={{ display: 'flex', cursor: 'pointer' }}
                        >
                            <Avatar
                                ccid={props.message.author}
                                src={props.message.authorProfile?.avatar}
                                style={{ width: '16px', height: '16px' }}
                            />
                        </div>
                    </div>
                }
            >
                <span
                    onClick={(e) => {
                        e.stopPropagation()
                        const link = props.message.value?.profileOverride?.link
                        if (link) {
                            // ブリッジ経由(AP/Bluesky)のauthorはサービスアカウントなので、元ユーザーのプロフィールへ
                            navigate(
                                link.startsWith('https://bsky.app/profile/')
                                    ? '/bluesky/view/' +
                                          encodeURIComponent(link.slice('https://bsky.app/profile/'.length))
                                    : '/activitypub/view/' + encodeURIComponent(link)
                            )
                        } else {
                            navigate(
                                '/profile/' +
                                    props.message.author +
                                    (props.message.authorProfileName && props.message.authorProfileName !== 'main'
                                        ? '/' + props.message.authorProfileName
                                        : '')
                            )
                        }
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <Text variant="caption">
                        {t('userRerouted', { name: props.message.authorProfile?.username || 'Anonymous' })}
                    </Text>
                </span>
                <div style={{ flex: 1 }} />
                {(props.message.author === client.ccid || unpublishCandidates.length > 0) && (
                    <>
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation()
                                setMenuOpen(true)
                            }}
                            style={
                                {
                                    padding: 0,
                                    margin: 0,
                                    width: '15px',
                                    height: '15px',
                                    anchorName: menuAnchor
                                } as React.CSSProperties
                            }
                        >
                            <MdMoreHoriz size={15} />
                        </IconButton>
                        <Select
                            open={menuOpen}
                            onClose={() => setMenuOpen(false)}
                            options={[
                                ...(props.message.author === client.ccid
                                    ? [
                                          <ListItem
                                              key="delete"
                                              onClick={() => {
                                                  client.api.delete(props.message.uri).then(() => {
                                                      qt.remove?.(props.message.uri)
                                                      hapticSuccess()
                                                  })
                                                  setMenuOpen(false)
                                              }}
                                          >
                                              <Text>{t('deleteReroute')}</Text>
                                          </ListItem>
                                      ]
                                    : []),
                                ...unpublishCandidates.map((candidate) => (
                                    <ListItem
                                        key={'unpublish:' + candidate.uri}
                                        onClick={() => {
                                            setMenuOpen(false)
                                            setUnpublishTarget(candidate)
                                        }}
                                    >
                                        <Text>{t('unpublishFrom', { name: candidate.name })}</Text>
                                    </ListItem>
                                ))
                            ]}
                            anchor={menuAnchor}
                        />
                    </>
                )}
                <div style={{ flexShrink: 0 }}>
                    <TimeDiff date={props.message.createdAt} />
                </div>
            </OnelineMessageLayout>
            <Confirm
                open={unpublishTarget !== null}
                onClose={() => setUnpublishTarget(null)}
                title={t('confirmUnpublish')}
                description={t('confirmUnpublishDescription', { name: unpublishTarget?.name })}
                confirmText={t('unpublish')}
                onConfirm={() => {
                    if (!unpublishTarget) return
                    // 配信先には core が <timeline>/<href のハッシュCDID> の参照レコードを作っているので、それを消す
                    const href = props.message.key ?? props.message.uri
                    client.api.delete(`${unpublishTarget.uri}/${CDID.newFromStringX(href).toString()}`).then(() => {
                        qt.remove?.(href)
                        hapticSuccess()
                    })
                }}
            />
            <ErrorBoundary FallbackComponent={RenderError}>
                {/* rerouteした本人は元投稿が見えているはずなので、そのホームドメインを解決hintに使う */}
                <MessageContainer
                    uri={props.message.value.targetURI}
                    hint={props.message.authorUser?.domain ?? props.message.hint}
                    rerouted={props.message}
                />
            </ErrorBoundary>
        </div>
    )
}
