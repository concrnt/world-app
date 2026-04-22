import { useState } from 'react'
import { View, Button, Divider, Skeleton, ConcrntLogo, Text, Avatar } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useScanner } from '../contexts/Scanner'
import { AvatarUploader } from '../components/AvatarUploader'
import { MessageLayout } from '../components/message/MessageLayout'
import { useClient } from '../contexts/Client'

export const DevView = () => {
    const { scan } = useScanner()
    const [scanned, setScanned] = useState<string>('')

    const [avatar, setAvatar] = useState<string>('')

    const { client } = useClient()

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

                <Button
                    onClick={() => {
                        window.location.reload()
                    }}
                >
                    Reload
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

                <MessageLayout
                    left={
                        <Skeleton
                            style={{
                                width: '40px',
                                height: '40px'
                            }}
                        />
                    }
                    headerLeft={
                        <Skeleton
                            style={{
                                height: '1rem'
                            }}
                        />
                    }
                >
                    <Skeleton
                        style={{
                            height: '3rem'
                        }}
                    />
                </MessageLayout>
                <ConcrntLogo size="100px" upperColor="#0476d9" lowerColor="#0476d9" frameColor="#0476d9" spinning />
                <div>
                    {client && (
                        <>
                            <Text>Client CCID: {client.ccid}</Text>
                            <Text>Profiles:</Text>
                            {Object.keys(client.profiles).map((name) => (
                                <div key={name}>
                                    <Avatar src={client.profiles[name].value.avatar} ccid={client.ccid} />
                                    <Text key={name}>
                                        {name}: {client.profiles[name].value.name}
                                    </Text>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </View>
    )
}
