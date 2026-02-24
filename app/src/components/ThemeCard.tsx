import { Theme } from '../types/Theme'
import { ConcrntLogo, Text } from '@concrnt/ui'

interface Props {
    theme: Theme
    onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
}

export const ThemeCard = (props: Props) => {
    const bgColor =
        props.theme.backdrop.background === props.theme.ui.text
            ? props.theme.ui.background
            : props.theme.backdrop.background

    return (
        <div
            style={{
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: props.theme.content.background,
                border: `1px solid ${props.theme.divider}`
            }}
            onClick={props.onClick}
        >
            <div
                style={{
                    display: 'flex',
                    borderRadius: '50%',
                    backgroundColor: props.theme.ui.text
                }}
            >
                <ConcrntLogo
                    size="40px"
                    upperColor={props.theme.ui.background}
                    lowerColor={bgColor}
                    frameColor={bgColor}
                />
            </div>
            <Text
                style={{
                    color: props.theme.content.text,
                    flexGrow: 1,
                    textTransform: 'none',
                    textOverflow: 'ellipsis',
                    display: 'block',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                }}
            >
                {props.theme.meta?.name || 'Unnamed Theme'}
            </Text>
        </div>
    )
}
