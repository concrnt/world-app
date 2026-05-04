import type { Theme } from '@concrnt/ui'
import { ConcrntLogo, CssVar, Text } from '@concrnt/ui'

interface Props {
    theme: Theme
    selected?: boolean
    onClick?: () => void
}

export const ThemeCard = (props: Props) => {
    const bgColor =
        props.theme.backdrop.background === props.theme.ui.text
            ? props.theme.ui.background
            : props.theme.backdrop.background

    return (
        <button
            type="button"
            onClick={props.onClick}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(3),
                padding: CssVar.space(4),
                borderRadius: CssVar.round(1),
                border: `1px solid ${props.selected ? props.theme.ui.background : props.theme.divider}`,
                backgroundColor: props.theme.content.background,
                cursor: 'pointer',
                textAlign: 'left'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    borderRadius: '9999px',
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
                    flex: 1
                }}
            >
                {props.theme.meta?.name ?? 'Unnamed Theme'}
            </Text>
        </button>
    )
}
