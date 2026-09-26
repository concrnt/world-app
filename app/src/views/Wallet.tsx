import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton, View } from '@concrnt/ui'
import { HiMiniArrowDownLeft } from 'react-icons/hi2'
import { MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { RiArrowDownSLine } from 'react-icons/ri'
import { Header } from '../ui/Header'
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

const TRANSACTIONS = [
    {
        type: 'receive' as const,
        amount: '0 ETH',
        counterparty: '0x12ab…ef34',
        date: '2026-09-26',
        fee: '0 ETH',
        hash: '0xab12…9c4e'
    },
    {
        type: 'send' as const,
        amount: '0 JPY',
        counterparty: '0x98cd…ab12',
        date: '2026-09-25',
        fee: '0 JPY',
        hash: '0xcd56…1a78'
    }
]

export const WalletView = () => {
    const { t, i18n } = useTranslation('', { keyPrefix: 'views.wallet' })
    const [balanceVisible, setBalanceVisible] = useState(true)
    const [openTxIds, setOpenTxIds] = useState<string[]>([])

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
                        {t('transactionLog')}
                    </span>
                    <div
                        style={{
                            borderRadius: '20px',
                            backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.06)`,
                            overflow: 'hidden'
                        }}
                    >
                        {TRANSACTIONS.map((tx, index) => {
                            const txId = `${tx.type}-${tx.counterparty}`
                            const open = openTxIds.includes(txId)

                            return (
                                <div
                                    key={txId}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderTop: index === 0 ? 'none' : `1px solid ${CssVar.divider}`
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'stretch',
                                            gap: CssVar.space(3),
                                            padding: CssVar.space(4),
                                            paddingLeft: CssVar.space(2)
                                        }}
                                    >
                                        <div
                                            aria-label={t(tx.type)}
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                flexShrink: 0,
                                                alignSelf: 'center',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.1)`
                                            }}
                                        >
                                            <HiMiniArrowDownLeft
                                                size={22}
                                                style={{
                                                    transform: tx.type === 'send' ? 'rotate(180deg)' : undefined
                                                }}
                                            />
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                minWidth: 0,
                                                flex: 1
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: '0.95rem',
                                                    fontWeight: 700,
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}
                                            >
                                                {balanceVisible ? tx.amount : HIDDEN}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    opacity: 0.55
                                                }}
                                            >
                                                {t(tx.type === 'receive' ? 'from' : 'to', { who: tx.counterparty })}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                alignSelf: 'stretch',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                justifyContent: 'space-between',
                                                flexShrink: 0
                                            }}
                                        >
                                            <IconButton
                                                title={open ? t('hideDetails') : t('showDetails')}
                                                onClick={() =>
                                                    setOpenTxIds((ids) =>
                                                        ids.includes(txId) ? ids.filter((id) => id !== txId) : [...ids, txId]
                                                    )
                                                }
                                                style={{
                                                    width: '28px',
                                                    height: '28px'
                                                }}
                                            >
                                                <RiArrowDownSLine
                                                    size={20}
                                                    style={{
                                                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.15s ease'
                                                    }}
                                                />
                                            </IconButton>
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    opacity: 0.55,
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}
                                            >
                                                {new Date(tx.date).toLocaleDateString(i18n.language, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    {open && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: CssVar.space(2),
                                                marginLeft: 'calc(48px + var(--space) * 5)',
                                                marginRight: CssVar.space(4),
                                                paddingBottom: CssVar.space(4),
                                                borderTop: `1px solid ${CssVar.divider}`,
                                                paddingTop: CssVar.space(3)
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: CssVar.space(3)
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        opacity: 0.55
                                                    }}
                                                >
                                                    {t('status')}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {t('confirmed')}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: CssVar.space(3)
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        opacity: 0.55
                                                    }}
                                                >
                                                    {t('fee')}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        fontVariantNumeric: 'tabular-nums'
                                                    }}
                                                >
                                                    {balanceVisible ? tx.fee : HIDDEN}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: CssVar.space(3)
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        opacity: 0.55
                                                    }}
                                                >
                                                    {t('hash')}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        fontVariantNumeric: 'tabular-nums'
                                                    }}
                                                >
                                                    {tx.hash}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </View>
    )
}
