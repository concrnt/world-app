import BoringAvatar from 'boring-avatars'
import { CCImage } from '../contexts/CCImage'

interface Props {
    ccid: string
    src?: string
    style?: React.CSSProperties
    onClick?: () => void
    badge?: React.ReactNode
    badgeColor?: string
    badgeSize?: number
}

export const Avatar = (props: Props) => {
    const body = <Inner {...props} />

    if (!props.badge) return body

    const badgeSize = props.badgeSize ?? 16
    // MUIのBadge(overlap=circular)風に、バッジの3割ほどをアバターの右下角から外へはみ出させる
    const badgeOffset = `${-Math.round(badgeSize * 0.3)}px`
    return (
        <div style={{ position: 'relative', width: 'fit-content' }}>
            {body}
            <div
                style={{
                    position: 'absolute',
                    bottom: badgeOffset,
                    right: badgeOffset,
                    width: `${badgeSize}px`,
                    height: `${badgeSize}px`,
                    borderRadius: '4px',
                    backgroundColor: props.badgeColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}
            >
                {props.badge}
            </div>
        </div>
    )
}

const Inner = (props: Props) => {
    if (props.src) {
        return (
            <CCImage
                src={props.src}
                maxWidth={256}
                alt="avatar"
                style={{
                    display: 'block',
                    width: '40px',
                    height: '40px',
                    borderRadius: '4px',
                    objectFit: 'cover',
                    ...props.style
                }}
                onClick={props.onClick}
            />
        )
    } else {
        return (
            <BoringAvatar
                square
                size={40}
                variant="beam"
                preserveAspectRatio="xMidYMid slice"
                style={{
                    display: 'block',
                    borderRadius: '4px',
                    ...props.style
                }}
                name={props.ccid}
                onClick={props.onClick}
            />
        )
    }
}
