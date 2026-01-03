import { Button } from '../ui/Button'
import { useClient } from '../contexts/Client'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'

export const SettingsView = () => {
    const { logout } = useClient()
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
                Settings
            </Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '0 8px'
                }}
            >
                <Button
                    onClick={() => {
                        logout()
                    }}
                >
                    Logout
                </Button>
            </div>
        </View>
    )
}
