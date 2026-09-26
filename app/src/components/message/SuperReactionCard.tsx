import { Avatar, CCImage, CircularProgress } from '@concrnt/ui'
import { CssVar } from '../../types/Theme'
import { FaEthereum } from 'react-icons/fa6'
import { MdErrorOutline, MdVerified } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { openUrl } from '@tauri-apps/plugin-opener'
import { usePreference } from '../../contexts/Preference'
import { explorerTxUrl } from '../../lib/tipjar'
import styles from './SuperReactionCard.module.css'

interface Props {
    author: string
    username: string
    avatar?: string
    eth: string
    imageUrl: string
    message?: string
    // 省略時はチェーン検証を伴わない表示(ウォレット画面の履歴など)
    status?: 'pending' | 'verified' | 'failed'
    reason?: string
    txhash?: string
}

export const SuperReactionCard = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.superReaction' })
    const [devmode] = usePreference('developerMode')
    return (
        <div
            className={styles.card}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                borderRadius: '4px',
                overflow: 'hidden',
                opacity: props.status === 'failed' ? 0.55 : 1,
                backgroundColor: `rgb(from ${CssVar.uiBackground} r g b / 0.1)`
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: props.message ? '8px 10px 4px 12px' : '8px 10px 8px 12px'
                    }}
                >
                    <Avatar
                        ccid={props.author}
                        src={props.avatar}
                        style={{ width: '32px', height: '32px', flexShrink: 0 }}
                    />
                    <div
                        style={{
                            flex: '0 1 auto',
                            minWidth: 0,
                            maxWidth: '42%',
                            fontSize: '14px',
                            lineHeight: '18px',
                            fontWeight: 700,
                            color: CssVar.contentText,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {props.username}
                    </div>
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            aspectRatio: '15 / 4',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                        }}
                    >
                        <CCImage
                            src={props.imageUrl}
                            maxHeight={1024}
                            alt=""
                            style={{
                                display: 'block',
                                width: 'auto',
                                height: 'auto',
                                maxWidth: '70%',
                                maxHeight: '70%',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                </div>
                {props.message ? (
                    <div
                        style={{
                            padding: '0 12px 10px 12px',
                            fontSize: '14px',
                            lineHeight: '20px',
                            fontWeight: 400,
                            color: CssVar.contentText,
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere'
                        }}
                    >
                        {props.message}
                    </div>
                ) : null}
            </div>
            <div
                role={props.txhash ? 'link' : undefined}
                onClick={(e) => {
                    if (!props.txhash) return
                    e.stopPropagation()
                    openUrl(explorerTxUrl(props.txhash)).catch((err) => {
                        console.error('failed to open explorer:', err)
                    })
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '6px',
                    minHeight: '32px',
                    padding: '6px 12px',
                    backgroundColor: CssVar.uiBackground,
                    color: CssVar.uiText,
                    fontSize: '14px',
                    lineHeight: '18px',
                    fontWeight: 700,
                    cursor: props.txhash ? 'pointer' : undefined
                }}
            >
                <FaEthereum size={14} />
                <span
                    style={{
                        textDecoration: props.status === 'failed' ? 'line-through' : undefined,
                        opacity: props.status === 'pending' ? 0.6 : 1
                    }}
                >
                    {props.eth} ETH
                </span>
                {props.status === 'pending' && (
                    <>
                        <CircularProgress size={14} />
                        <span style={{ fontWeight: 400, opacity: 0.8 }}>{t('verifying')}</span>
                    </>
                )}
                {props.status === 'verified' && (
                    <>
                        <MdVerified size={16} />
                        <span style={{ fontWeight: 400, opacity: 0.8 }}>{t('verified')}</span>
                    </>
                )}
                {props.status === 'failed' && (
                    <>
                        <MdErrorOutline size={16} />
                        <span style={{ fontWeight: 400, opacity: 0.8 }}>
                            {t('failed')}
                            {devmode && props.reason ? ` (${props.reason})` : ''}
                        </span>
                    </>
                )}
            </div>
        </div>
    )
}
