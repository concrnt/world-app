import { Theme } from '../types/Theme'
import { ConcrntLogo } from '../ui/ConcrntLogo'
import { Text } from '../ui/Text'

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
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 'var(--space-3)',
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
                    size="md"
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
