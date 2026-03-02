import { Button, View } from '@concrnt/ui'

interface Props {
    onBack?: () => void
}

export const AccountImport = (props: Props) => {
    return (
        <View>
            <Button onClick={props.onBack}>Back</Button>
        </View>
    )
}
