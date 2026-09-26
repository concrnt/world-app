import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '@concrnt/ui'
import { MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { SuperReactionCard } from '../components/message/SuperReactionCard'
import { useSuperReactionLog, type SuperReactionMock } from '../components/message/superReactionMock'
import { CssVar } from '../types/Theme'

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

const ETH_BALANCE = '0'
const JPY_BALANCE = '0'
const ETH_HIDDEN = '---,---'
const HIDDEN = '-'

const SAMPLE_REACTIONS: SuperReactionMock[] = [
    {
        id: 'sample-1',
        messageUri: 'sample',
        author: 'con1sampleauthor00000000000000000001',
        username: 'だぶ',
        imageUrl: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f389.svg',
        eth: '0.00024',
        message: 'ありがとう'
    },
    {
        id: 'sample-2',
        messageUri: 'sample',
        author: 'con1sampleauthor00000000000000000002',
        username: 'kurotori',
        imageUrl: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f496.svg',
        eth: '0.0024',
        message: 'うれしい'
    },
    {
        id: 'sample-3',
        messageUri: 'sample',
        author: 'con1sampleauthor00000000000000000003',
        username: 'fluffy',
        imageUrl: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f44d.svg',
        eth: '0.012'
    }
]

export const WalletView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.wallet' })
    const [balanceVisible, setBalanceVisible] = useState(true)
    const liveReactions = useSuperReactionLog()
    const reactions = liveReactions.length > 0 ? liveReactions : SAMPLE_REACTIONS

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
                                {balanceVisible ? ETH_BALANCE : ETH_HIDDEN}
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
                        {reactions.map((reaction) => (
                            <SuperReactionCard
                                key={reaction.id}
                                author={reaction.author}
                                username={reaction.username}
                                avatar={reaction.avatar}
                                eth={balanceVisible ? reaction.eth : HIDDEN}
                                imageUrl={reaction.imageUrl}
                                message={reaction.message}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </View>
    )
}
