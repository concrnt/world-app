import { useStack } from '../layouts/Stack'
import { Header } from '../ui/Header'
import { Text } from '../ui/Text'
import { View } from '../ui/View'
import { MdArrowBack } from 'react-icons/md'

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
                        <MdArrowBack size={24} />
                    </div>
                }
            >
                Post
            </Header>
            <Text>Post (URI: {props.uri})</Text>
        </View>
    )
}
