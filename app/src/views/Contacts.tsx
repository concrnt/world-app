import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'

export const ContactsView = () => {
    const { open } = useSidebar()

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
                        onClick={() => open()}
                    >
                        <MdMenu size={24} />
                    </div>
                }
            >
                Contacts
            </Header>
        </View>
    )
}
