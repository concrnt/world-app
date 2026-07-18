import { type ReactNode } from 'react'
import { CssVar } from '../types/Theme'
import { Text } from './Text'
import { CCImage } from '../contexts/CCImage'

// Minimal shape needed to render an emoji package card. A fetched emoji package
// (name/iconURL/emojis[]) is structurally assignable to this.
export interface EmojipackLite {
    name: string
    iconURL: string
    emojis: { shortcode: string; imageURL: string }[]
}

interface Props {
    pack: EmojipackLite
    onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
    action?: ReactNode
}

export const EmojipackCard = (props: Props) => {
    const previews = props.pack.emojis?.slice(0, 8) ?? []

    return (
        <div
            style={{
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: CssVar.contentBackground,
                border: `1px solid ${CssVar.divider}`
            }}
            onClick={props.onClick}
        >
            <CCImage
                src={props.pack.iconURL}
                maxHeight={128}
                alt={props.pack.name}
                style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Text
                    style={{
                        color: CssVar.contentText,
                        textTransform: 'none',
                        textOverflow: 'ellipsis',
                        display: 'block',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {props.pack.name || 'Unnamed Pack'}
                </Text>
                {previews.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', overflow: 'hidden' }}>
                        {previews.map((emoji, i) => (
                            <CCImage
                                key={`${emoji.shortcode}-${i}`}
                                src={emoji.imageURL}
                                maxHeight={128}
                                alt={emoji.shortcode}
                                style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }}
                            />
                        ))}
                    </div>
                )}
            </div>
            {props.action}
        </div>
    )
}
