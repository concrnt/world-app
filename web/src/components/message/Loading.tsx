import { ConcrntLogo, CssVar, Text } from '@concrnt/ui'
import { ReactNode } from 'react'

interface Props {
    message: string
}

export const Loading = (props: Props): ReactNode => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
            }}
        >
            <ConcrntLogo
                spinning
                size="30px"
                upperColor={CssVar.contentText}
                lowerColor={CssVar.contentText}
                frameColor={CssVar.contentText}
            />
            <Text variant="body">{props.message}</Text>
        </div>
    )
}
