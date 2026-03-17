import { useState } from 'react'
import { View, Button, Divider } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useScanner } from '../contexts/Scanner'
import { AvatarUploader } from '../components/AvatarUploader'

export const DevView = () => {
    const { scan } = useScanner()
    const [scanned, setScanned] = useState<string>('')

    const [avatar, setAvatar] = useState<string>('')

    return (
        <View>
            <Header>Devtools</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2),
                    flex: 1,
                    overflowY: 'auto'
                }}
            >
                <Button
                    onClick={() => {
                        scan().then((result) => {
                            if (result) {
                                setScanned(result)
                                console.log('Scanned:', result)
                            } else {
                                console.log('No scan result')
                            }
                        })
                    }}
                >
                    Scan
                </Button>

                <pre>
                    <code>{scanned}</code>
                </pre>

                <Divider />

                <AvatarUploader
                    src={avatar}
                    onChange={(url) => {
                        setAvatar(url)
                        console.log('Avatar URL:', url)
                    }}
                />
            </div>
        </View>
    )
}
