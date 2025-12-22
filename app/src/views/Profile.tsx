import { useStack } from "../layouts/Stack";
import { Header } from "../ui/Header";
import { Text } from "../ui/Text";
import { View } from "../ui/View";

interface Props {
    id: string
}

export const ProfileView = (props: Props) => {

    const { pop } = useStack()

    return (
        <View>
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

        </View>
    )

}
