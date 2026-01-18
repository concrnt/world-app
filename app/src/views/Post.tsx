import { MessageContainer } from '../components/message'
import { Divider } from '../ui/Divider'
import { FAB } from '../ui/FAB'
import { Header } from '../ui/Header'
import { View } from '../ui/View'
import { MdReply } from 'react-icons/md'

interface Props {
    uri: string
}

export const PostView = (props: Props) => {
    return (
        <>
            <View>
                <Header>Post</Header>
                <div
                    style={{
                        padding: '8px'
                    }}
                >
                    <MessageContainer uri={props.uri} />
                </div>
                <Divider />
            </View>
            <FAB>
                <MdReply size={24} />
            </FAB>
        </>
    )
}
