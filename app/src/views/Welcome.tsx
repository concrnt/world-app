import { Button } from '../ui/Button'
import { Text } from '../ui/Text'

import ConcrntLogo from '/concrnt.svg'
import { useClient } from '../contexts/Client'
import { View } from '../ui/View'

export const WelcomeView = () => {
    const { initialize } = useClient()

    return (
        <View>
            <img src={ConcrntLogo} alt="Concrnt Logo" style={{ width: '150px', height: '150px' }} />

            <Text>ようこそ</Text>

            <Button
                onClick={() => {
                    initialize()
                }}
            >
                はじめる
            </Button>

            <Button variant="text">ログイン</Button>
        </View>
    )
}
