import { useStack } from "../layouts/Stack";
import { Header } from "../ui/Header";
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
                backgroundColor: '#fff',
            }}
        >
            <Header
                left={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        onClick={() => {
                            pop()
                        }}
                    >
                        🔙
                    </div>
                }
            >
                Post
            </Header>
            <Text>
                Profile (ID: {props.id})
            </Text>

        </div>
    )

}
