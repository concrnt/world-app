import { Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, CircularProgress, IconButton, Text, View } from '@concrnt/ui'
import { MdCallMade, MdCallReceived, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { Association, Schemas, semantics, type Client, type SuperreactionAssociationSchema } from '@concrnt/worldlib'
import type { Document } from '@concrnt/client'
import { Header } from '../ui/Header'
import { SuperReactionItem, type SuperReactionPair } from '../components/message/SuperReactionItem'
import { TimeDiff } from '../components/TimeDiff'
import { useClient } from '../contexts/Client'
import { useStack } from '../layouts/Stack'
import { useHaptics } from '../contexts/Haptics'
import { getEthAddress } from '../lib/eth'
import { invalidateResource, useResource } from '../hooks/useResource'
import { getWalletBalance } from '../lib/tipjar'
import { withdrawTips } from '../lib/superReaction'
import { CssVar } from '../types/Theme'
import { PostView } from './Post'

const BanknoteArrowDown = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M12 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5" />
        <path d="m16 19 3 3 3-3" />
        <path d="M18 12h.01" />
        <path d="M19 16v6" />
        <path d="M6 12h.01" />
        <circle cx="12" cy="12" r="2" />
    </svg>
)

const BanknoteArrowUp = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M12 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5" />
        <path d="M18 12h.01" />
        <path d="M19 22v-6" />
        <path d="m22 19-3-3-3 3" />
        <path d="M6 12h.01" />
        <circle cx="12" cy="12" r="2" />
    </svg>
)

const JPY_BALANCE = '0'
const ETH_HIDDEN = '---,---'
const HIDDEN = '-'
const HISTORY_PAGE = 30
const REFERENCE_SCHEMA = 'https://schema.concrnt.net/reference.json'

// formatEther の文字列を表示用に小数6桁までへ切り詰め、末尾の 0 と '.' を落とす
const trimEth = (eth: string): string => {
    const m = /^(\d+)(?:\.(\d{0,6}))?/.exec(eth)
    if (!m) return eth
    const frac = (m[2] ?? '').replace(/0+$/, '')
    return frac ? `${m[1]}.${frac}` : m[1]
}

// 残高(EOA + TipSplitter 未引き出し分)。SWR キャッシュで、送信/引き出し後に invalidate する。
// 取得失敗は null で受ける(fetcher を reject させると useResource が再フェッチをループする)
const useWalletBalance = () => {
    const { client } = useClient()
    return useResource(`ethbalance:${client.ccid}`, () =>
        getEthAddress(client.ccid)
            .then((address) => getWalletBalance(address))
            .catch((e) => {
                console.error('failed to get eth address:', e)
                return null
            })
    )
}

// Suspense 配下: 総資産の数字
const Balance = (props: { visible: boolean }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.wallet' })
    const balance = useWalletBalance()
    if (balance === null) {
        return (
            <>
                --
                <span
                    style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 400,
                        letterSpacing: 'normal',
                        opacity: 0.7
                    }}
                >
                    {t('balanceUnavailable')}
                </span>
            </>
        )
    }
    return <>{props.visible ? trimEth(balance.total) : ETH_HIDDEN}</>
}

// Suspense 配下: 未受け取り(TipSplitter にプールされた)分の案内と引き出しボタン。0 なら何も出さない
const Unclaimed = (props: { visible: boolean }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.wallet' })
    const { client } = useClient()
    const { hapticLight } = useHaptics()
    const balance = useWalletBalance()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    if (!balance || Number(balance.pooled) === 0) return null

    const claim = () => {
        if (busy) return
        setBusy(true)
        setError(undefined)
        withdrawTips(client)
            .then(() => {
                hapticLight()
                invalidateResource('ethbalance:')
            })
            .catch((e) => {
                console.error('failed to withdraw tips:', e)
                setError(t('claimFailed'))
            })
            .finally(() => {
                setBusy(false)
            })
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: CssVar.space(2),
                    fontSize: '0.8rem',
                    minWidth: 0
                }}
            >
                <span style={{ flex: 1, minWidth: 0, opacity: 0.7 }}>
                    {t('unclaimed', { amount: props.visible ? trimEth(balance.pooled) : HIDDEN })}
                </span>
                <Button
                    variant="text"
                    disabled={busy}
                    onClick={claim}
                    style={{
                        flexShrink: 0,
                        minHeight: '32px',
                        padding: `0 ${CssVar.space(2)}`,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    {busy && <CircularProgress size={14} />}
                    {busy ? t('claiming') : t('claim')}
                </Button>
            </div>
            {error && (
                <Text variant="caption" style={{ color: 'red' }}>
                    {error}
                </Text>
            )}
        </div>
    )
}

interface WalletReaction {
    pair: SuperReactionPair
    direction: 'received' | 'sent'
    // sent: 対象投稿の作者、received: 反応した人
    counterpart: { ccid: string; username: string }
    targetUri: string
    receiverDomain?: string
}

// 受信(通知タイムライン)と送信(アクティビティタイムライン)の superreaction を1本にまとめ、
// 対応する upgrade(tx hash)がある組だけを時刻降順で返す。plain object のみ(useResource が JSON 比較する)
const fetchWalletReactions = async (client: Client): Promise<WalletReaction[]> => {
    const prefixes = [
        semantics.notificationTimeline(client.ccid, client.currentProfile) + '/',
        semantics.activityTimeline(client.ccid, client.currentProfile) + '/'
    ]
    const pages = await Promise.all(
        prefixes.map((prefix) =>
            client.api.query({ prefix, schema: Schemas.superreactionAssociation, limit: HISTORY_PAGE }).catch((e) => {
                console.error('failed to query superreactions:', e)
                return { items: [] }
            })
        )
    )
    // 自分の投稿に自分でスーパーリアクションすると両タイムラインに載るので ccfs で重複排除
    const hrefs = new Set<string>()
    for (const page of pages) {
        for (const item of page.items) {
            const doc: Document<any> = JSON.parse(item.document)
            hrefs.add(doc.schema === REFERENCE_SCHEMA ? doc.value.href : item.ccfs)
        }
    }
    const result = await Promise.all(
        [...hrefs].map(async (href): Promise<WalletReaction | null> => {
            const msg = await client.getMessage<SuperreactionAssociationSchema>(href).catch(() => null)
            if (!msg?.associate) return null
            const target = msg.associationTarget ?? undefined
            const receiverDomain = target?.authorUser?.domain
            // upgrade は同じ人が同じ superreaction を指しているものだけ採用(SuperReactionList と同じ基準)
            const upgrades = await client.api
                .getAssociationsAll(
                    msg.associate,
                    { schema: Schemas.upgradeAssociation, author: msg.author },
                    receiverDomain
                )
                .catch(() => [])
            const up = upgrades.map((sd) => Association.fromSignedDocument(sd)).find((u) => u.value.target === msg.uri)
            if (!up) return null
            const sent = msg.author === client.ccid
            return {
                pair: {
                    ccfs: msg.uri,
                    author: msg.author,
                    associate: msg.associate,
                    txhash: up.value.txhash,
                    username: msg.authorProfile.username || 'Anonymous',
                    avatar: msg.authorProfile.avatar,
                    imageUrl: msg.value.imageUrl,
                    message: msg.value.message,
                    declaredAmount: msg.value.amount,
                    createdAt: msg.createdAt.getTime()
                },
                direction: sent ? 'sent' : 'received',
                counterpart: sent
                    ? { ccid: target?.author ?? '', username: target?.authorProfile.username || 'Anonymous' }
                    : { ccid: msg.author, username: msg.authorProfile.username || 'Anonymous' },
                targetUri: msg.associate,
                receiverDomain
            }
        })
    )
    return result.filter((r): r is WalletReaction => r !== null).sort((a, b) => b.pair.createdAt - a.pair.createdAt)
}

// Suspense 配下: 履歴一覧
const ReactionHistory = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.wallet' })
    const { client } = useClient()
    const { push } = useStack()
    // 失敗は空扱い(reject させると useResource が再フェッチをループする)
    const reactions = useResource(`wallet-superreactions:${client.ccid}:${client.currentProfile}`, () =>
        fetchWalletReactions(client).catch((e) => {
            console.error('failed to load wallet reactions:', e)
            return []
        })
    )
    if (reactions.length === 0) {
        return (
            <Text variant="caption" style={{ opacity: 0.7 }}>
                {t('noReactions')}
            </Text>
        )
    }
    return (
        <>
            {reactions.map((r) => (
                <div
                    key={r.pair.ccfs}
                    onClick={() => push(<PostView uri={r.targetUri} />)}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: 'pointer'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '0 4px',
                            fontSize: '0.8rem',
                            opacity: 0.7,
                            minWidth: 0
                        }}
                    >
                        {r.direction === 'received' ? <MdCallReceived size={16} /> : <MdCallMade size={16} />}
                        <span
                            style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {r.direction === 'received' ? t('received') : t('sent', { name: r.counterpart.username })}
                        </span>
                        <TimeDiff date={new Date(r.pair.createdAt)} />
                    </div>
                    <SuperReactionItem pair={r.pair} receiverDomain={r.receiverDomain} />
                </div>
            ))}
        </>
    )
}

export const WalletView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.wallet' })
    const [balanceVisible, setBalanceVisible] = useState(true)

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(4),
                    padding: CssVar.space(4)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    <span
                        style={{
                            fontSize: '0.95rem',
                            fontWeight: 600
                        }}
                    >
                        {t('accountBalance')}
                    </span>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(2)
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: '0.35rem'
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '2.25rem',
                                    fontWeight: 700,
                                    letterSpacing: balanceVisible ? '-0.03em' : '0.08em',
                                    lineHeight: 1.15,
                                    fontVariantNumeric: 'tabular-nums'
                                }}
                            >
                                <Suspense fallback={<>…</>}>
                                    <Balance visible={balanceVisible} />
                                </Suspense>
                            </span>
                            <span
                                style={{
                                    fontSize: '1.15rem',
                                    fontWeight: 650
                                }}
                            >
                                ETH
                            </span>
                        </div>
                        <IconButton
                            title={balanceVisible ? t('hideBalance') : t('showBalance')}
                            onClick={() => setBalanceVisible((visible) => !visible)}
                            style={{
                                width: '40px',
                                height: '40px',
                                marginLeft: 'auto',
                                backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.08)`
                            }}
                        >
                            {balanceVisible ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
                        </IconButton>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '0.3rem',
                            opacity: 0.55
                        }}
                    >
                        <span
                            style={{
                                fontSize: '1rem',
                                fontWeight: 500,
                                fontVariantNumeric: 'tabular-nums'
                            }}
                        >
                            {balanceVisible ? JPY_BALANCE : HIDDEN}
                        </span>
                        <span
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 500
                            }}
                        >
                            JPY
                        </span>
                    </div>
                    <Suspense fallback={null}>
                        <Unclaimed visible={balanceVisible} />
                    </Suspense>
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: CssVar.space(2)
                    }}
                >
                    <Button
                        style={{
                            flex: 1,
                            minWidth: 0,
                            justifyContent: 'flex-start',
                            gap: CssVar.space(3),
                            minHeight: '64px',
                            padding: CssVar.space(2),
                            paddingLeft: CssVar.space(4),
                            borderRadius: '20px',
                            border: 'none',
                            backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.06)`,
                            color: CssVar.contentText,
                            fontSize: '0.95rem',
                            fontWeight: 700
                        }}
                    >
                        <BanknoteArrowDown />
                        {t('addMoney')}
                    </Button>
                    <Button
                        style={{
                            flex: 1,
                            minWidth: 0,
                            justifyContent: 'flex-start',
                            gap: CssVar.space(3),
                            minHeight: '64px',
                            padding: CssVar.space(2),
                            paddingLeft: CssVar.space(4),
                            borderRadius: '20px',
                            border: 'none',
                            backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.06)`,
                            color: CssVar.contentText,
                            fontSize: '0.95rem',
                            fontWeight: 700
                        }}
                    >
                        <BanknoteArrowUp />
                        {t('sendMoney')}
                    </Button>
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    <span
                        style={{
                            fontSize: '1.05rem',
                            fontWeight: 650
                        }}
                    >
                        {t('reactionLog')}
                    </span>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2)
                        }}
                    >
                        <Suspense
                            fallback={
                                <div style={{ display: 'flex', justifyContent: 'center', padding: CssVar.space(2) }}>
                                    <CircularProgress size={24} />
                                </div>
                            }
                        >
                            <ReactionHistory />
                        </Suspense>
                    </div>
                </div>
            </div>
        </View>
    )
}
