import BoringAvatar from 'boring-avatars'

interface Props {
    ccid: string
    src?: string
    style?: React.CSSProperties
}

export const Avatar = (props: Props) => {
    if (props.src) {
        return (
            <img
                src={props.src}
                alt="avatar"
                style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '4px',
                    ...props.style
                }}
            />
        )
    } else {
        return (
            <BoringAvatar
                square
                size={40}
                variant="beam"
                style={{
                    borderRadius: '4px',
                    ...props.style
                }}
            />
        )
    }
}
