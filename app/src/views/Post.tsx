import { useStack } from "../layouts/StackLayout";
import { Button } from "../ui/Button";
import { Text } from "../ui/Text";

interface Props {
    uri: string
}

export const PostView = (props: Props) => {

    const { pop } = useStack()

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                backgroundColor: '#fff',
            }}
        >
            <Button
                variant="text"
                onClick={() => {
                    pop()
                }}
            >
                Back
            </Button>
            <Text>
                Post (URI: {props.uri})
            </Text>

        </div>
    )
}
