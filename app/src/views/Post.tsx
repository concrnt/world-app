import { useStack } from '../layouts/Stack'
import { Header } from '../ui/Header'
import { Text } from '../ui/Text'
import { View } from '../ui/View'

interface Props {
    uri: string
}

export const PostView = (props: Props) => {
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
                            alignItems: 'center'
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
            <Text>Post (URI: {props.uri})</Text>
        </View>
    )
}
