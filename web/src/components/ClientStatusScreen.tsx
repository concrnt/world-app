import { Text } from '@concrnt/ui'
import { AuthActions, AuthButton, AuthScreen, AuthTextButton, PageHeader } from './AuthLayout'

interface Props {
    title: string
    description: string
    primaryLabel?: string
    onPrimary?: () => void
    secondaryLabel?: string
    onSecondary?: () => void
}

export const ClientStatusScreen = (props: Props) => {
    return (
        <AuthScreen>
            <PageHeader title={props.title} />
            <Text
                style={{
                    width: '100%',
                    textAlign: 'left'
                }}
            >
                {props.description}
            </Text>
            {(props.primaryLabel || props.secondaryLabel) && (
                <AuthActions>
                    {props.primaryLabel && <AuthButton onClick={props.onPrimary}>{props.primaryLabel}</AuthButton>}
                    {props.secondaryLabel && (
                        <AuthTextButton onClick={props.onSecondary}>{props.secondaryLabel}</AuthTextButton>
                    )}
                </AuthActions>
            )}
        </AuthScreen>
    )
}
