import { Button, Text, View } from '@concrnt/ui'

import ConcrntLogo from '/concrnt.svg'
import { useClient } from '../contexts/Client'
import { useResetPreference } from '../contexts/Preference'

export const WelcomeView = () => {
    const { initialize } = useClient()
    const reset = useResetPreference()

    return (
        <View>
            <img src={ConcrntLogo} alt="Concrnt Logo" style={{ width: '150px', height: '150px' }} />

            <Text>ようこそ</Text>

            <Button
                onClick={() => {
                    initialize()
                    reset()
                }}
            >
                はじめる
            </Button>

            <Button variant="text">ログイン</Button>
        </View>
    )
}
