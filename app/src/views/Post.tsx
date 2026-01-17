import { MessageContainer } from '../components/message'
import { useStack } from '../layouts/Stack'
import { Divider } from '../ui/Divider'
import { FAB } from '../ui/FAB'
import { Header } from '../ui/Header'
import { View } from '../ui/View'
import { MdArrowBack } from 'react-icons/md'
import { MdReply } from 'react-icons/md'

interface Props {
    uri: string
}

export const PostView = (props: Props) => {
    const { pop } = useStack()

    return (
        <>
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
