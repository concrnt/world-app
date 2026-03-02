import { Button, Text, View } from '@concrnt/ui'

import ConcrntLogo from '/concrnt.svg'

import { useState } from 'react'
import { AccountSetup } from '../views/AccountSetup'
import { AccountImport } from '../views/AccountImport'

export const WelcomeView = () => {
    const [mode, setMode] = useState<'signup' | 'signin' | 'welcome'>('welcome')

    switch (mode) {
        case 'signup':
            return <AccountSetup onBack={() => setMode('welcome')} />
        case 'signin':
            return <AccountImport onBack={() => setMode('welcome')} />
        case 'welcome':
            return (
                <View>
                    <img src={ConcrntLogo} alt="Concrnt Logo" style={{ width: '150px', height: '150px' }} />

                    <Text>ようこそ</Text>

                    <Button onClick={() => setMode('signup')}>はじめる</Button>

                    <Button variant="text" onClick={() => setMode('signin')}>
                        ログイン
                    </Button>
                </View>
            )
    }
}
