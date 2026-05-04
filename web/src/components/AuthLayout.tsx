/* eslint-disable react-refresh/only-export-components */
import type { CSSProperties, ReactNode } from 'react'
import { Button, ConcrntLogo, CssVar, Text } from '@concrnt/ui'

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
                overflowY: 'auto',
                boxSizing: 'border-box'
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
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: CssVar.space(3)
            }}
        >
            <ConcrntLogo
                size="72px"
                upperColor={CssVar.uiText}
                lowerColor={CssVar.uiText}
                frameColor={CssVar.uiText}
            />
            <Text
                variant="h1"
                style={{
                    color: CssVar.uiText,
                    margin: 0
                }}
            >
                Concrnt
            </Text>
        </div>
    )
}

export const AuthHeader = (props: { title: string; description?: ReactNode; compact?: boolean }) => {
    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                textAlign: 'right',
                gap: CssVar.space(1)
            }}
        >
            <Text
                variant="h1"
                style={{
                    color: CssVar.uiText,
                    fontSize: props.compact ? '1.35rem' : '1.45rem',
                    lineHeight: 1.2,
                    margin: 0
                }}
            >
                {props.title}
            </Text>
            {props.description && (
                <Text
                    style={{
                        color: CssVar.uiText,
                        opacity: 0.78,
                        lineHeight: 1.6,
                        fontSize: '0.95rem',
                        margin: 0
                    }}
                >
                    {props.description}
                </Text>
            )}
        </div>
    )
}

export const PageHeader = (props: { title: string; description?: ReactNode; brandOnly?: boolean }) => {
    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(1)
            }}
        >
            <div
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: CssVar.space(3)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(2),
                        flexShrink: 0,
                        minHeight: 36
                    }}
                >
                    <ConcrntLogo
                        size="36px"
                        upperColor={CssVar.uiText}
                        lowerColor={CssVar.uiText}
                        frameColor={CssVar.uiText}
                    />
                    <Text
                        style={{
                            fontSize: '28px',
                            lineHeight: 1,
                            color: CssVar.uiText,
                            fontWeight: 700,
                            margin: 0
                        }}
                    >
                        Concrnt
                    </Text>
                </div>
                <div
                    style={{
                        width: 'fit-content',
                        maxWidth: '60%',
                        marginLeft: 'auto'
                    }}
                >
                    <AuthHeader title={props.title} compact={props.brandOnly} />
                </div>
            </div>
            {props.description && (
                <Text
                    style={{
                        width: '100%',
                        textAlign: 'right',
                        color: CssVar.uiText,
                        opacity: 0.78,
                        fontSize: '0.95rem',
                        lineHeight: 1.6,
                        margin: 0
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
    onClick?: () => void
    disabled?: boolean
}) => {
    return (
        <Button
            disabled={props.disabled}
            onClick={props.onClick}
            style={{
                width: '100%',
                minHeight: 48,
                color: CssVar.uiBackground,
                backgroundColor: CssVar.uiText,
                border: 'none',
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
    onClick?: () => void
    danger?: boolean
}) => {
    return (
        <button
            type="button"
            onClick={props.onClick}
            style={{
                padding: 0,
                border: 'none',
                backgroundColor: 'transparent',
                color: props.danger ? CssVar.uiText : CssVar.uiText,
                opacity: props.danger ? 0.78 : 1,
                cursor: 'pointer',
                fontSize: '0.95rem'
            }}
        >
            {props.children}
        </button>
    )
}

export const authStyles = {
    section: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: CssVar.space(3)
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
    } satisfies CSSProperties
}
