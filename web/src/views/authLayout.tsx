import type { CSSProperties, ReactNode } from 'react'
import { Button, ConcrntLogo, CssVar, Text } from '@concrnt/ui'

export const authStyles = {
    section: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: CssVar.space(3)
    } satisfies CSSProperties,
    passportWrap: {
        width: '100%',
        maxWidth: 420,
        margin: `${CssVar.space(4)} auto`
    } satisfies CSSProperties,
    inputGroup: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: CssVar.space(2)
    } satisfies CSSProperties,
    status: {
        minHeight: 24,
        color: CssVar.uiText,
        opacity: 0.78
    } satisfies CSSProperties,
    ccid: {
        wordBreak: 'break-all',
        color: CssVar.uiText,
        opacity: 0.72
    } satisfies CSSProperties
}

export const AuthScreen = (props: { children: ReactNode; align?: 'center' | 'top' }) => {
    return (
        <div
            style={{
                minHeight: '100dvh',
                width: '100dvw',
                padding: `calc(env(safe-area-inset-top) + ${CssVar.space(8)}) ${CssVar.space(5)} calc(env(safe-area-inset-bottom) + ${CssVar.space(5)})`,
                color: CssVar.uiText,
                backgroundColor: CssVar.uiBackground,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: props.align === 'top' ? 'flex-start' : 'center',
                overflowY: 'auto'
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 440,
                    minHeight: props.align === 'top' ? 'auto' : 520,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: props.align === 'top' ? 'flex-start' : 'center',
                    gap: CssVar.space(5)
                }}
            >
                {props.children}
            </div>
        </div>
    )
}

export const AuthBrand = () => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: CssVar.space(3)
            }}
        >
            <ConcrntLogo
                size="104px"
                upperColor={CssVar.uiText}
                lowerColor={CssVar.uiText}
                frameColor={CssVar.uiText}
            />
            <Text
                style={{
                    fontSize: '42px',
                    lineHeight: 1,
                    color: CssVar.uiText,
                    fontWeight: 700
                }}
            >
                Concrnt
            </Text>
        </div>
    )
}

export const AuthHeader = (props: { title: string; description?: ReactNode }) => {
    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: CssVar.space(2)
            }}
        >
            <Text
                variant="h1"
                style={{
                    color: CssVar.uiText,
                    fontSize: '2rem',
                    lineHeight: 1.2
                }}
            >
                {props.title}
            </Text>
            {props.description && (
                <Text
                    style={{
                        color: CssVar.uiText,
                        opacity: 0.78,
                        lineHeight: 1.7
                    }}
                >
                    {props.description}
                </Text>
            )}
        </div>
    )
}

export const AuthActions = (props: { children: ReactNode; fixedBottom?: boolean }) => {
    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: CssVar.space(3),
                marginTop: props.fixedBottom ? 'auto' : CssVar.space(2)
            }}
        >
            {props.children}
        </div>
    )
}

export const AuthButton = (props: {
    children: ReactNode
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
    variant?: 'contained' | 'outlined'
    danger?: boolean
}) => {
    return (
        <Button
            variant={props.variant ?? 'contained'}
            disabled={props.disabled}
            onClick={props.onClick}
            style={{
                width: '100%',
                minHeight: 48,
                color: props.danger ? '#ff5b5b' : CssVar.uiBackground,
                backgroundColor: props.variant === 'outlined' ? 'transparent' : CssVar.uiText,
                border: props.variant === 'outlined' ? `1px solid ${props.danger ? '#ff5b5b' : CssVar.uiText}` : 'none',
                fontSize: '1rem',
                fontWeight: 700
            }}
        >
            {props.children}
        </Button>
    )
}

export const AuthTextButton = (props: {
    children: ReactNode
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    danger?: boolean
}) => {
    return (
        <Button
            variant="text"
            onClick={props.onClick}
            style={{
                width: '100%',
                minHeight: 44,
                color: props.danger ? '#ff7676' : CssVar.uiText,
                fontSize: '1rem'
            }}
        >
            {props.children}
        </Button>
    )
}
