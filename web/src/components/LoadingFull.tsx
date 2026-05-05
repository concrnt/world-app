import { ConcrntLogo, CssVar, Text } from '@concrnt/ui'

interface Props {
    children?: React.ReactNode
}

export const LoadingFull = (props: Props) => {
    return (
        <div
            style={{
                height: '100dvh',
                width: '100dvw',
                backgroundColor: CssVar.uiBackground,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)'
            }}
        >
            <ConcrntLogo
                spinning
                size="100px"
                upperColor={CssVar.uiText}
                lowerColor={CssVar.uiText}
                frameColor={CssVar.uiText}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: 'calc(env(safe-area-inset-bottom) + 10px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                {props.children}
                <Text
                    style={{
                        color: CssVar.uiText,
                        fontWeight: 600,
                        fontSize: '22px'
                    }}
                >
                    Concrnt
                </Text>
            </div>
        </div>
    )
}
