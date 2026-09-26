import { Avatar, CCImage } from '@concrnt/ui'
import { CssVar } from '../../types/Theme'
import { FaEthereum } from 'react-icons/fa6'
import styles from './SuperReactionCard.module.css'

interface Props {
    author: string
    username: string
    avatar?: string
    eth: string
    imageUrl: string
}

export const SuperReactionCard = (props: Props) => {
    return (
        <div
            className={styles.card}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: `rgb(from ${CssVar.uiBackground} r g b / 0.1)`
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 10px 8px 12px'
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
                            maxWidth: '100%',
                            maxHeight: '200px',
                            objectFit: 'contain'
                        }}
                    />
                </div>
            </div>
            <div
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
                    fontWeight: 700
                }}
            >
                <FaEthereum size={14} />
                <span>{props.eth} ETH</span>
            </div>
        </div>
    )
}
