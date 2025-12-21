import { useStack } from "../layouts/StackLayout";
import { Button } from "../ui/Button";
import { Text } from "../ui/Text";

interface Props {
    id: string
}

export const ProfileView = (props: Props) => {

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
                Profile (ID: {props.id})
            </Text>

        </div>
    )
}
