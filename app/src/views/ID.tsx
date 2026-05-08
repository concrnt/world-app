import { View, Button } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { Passport } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { MdQrCodeScanner } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { QRSetup } from './QRSetup'
import { BackupKeyButton } from '../components/BackupKeyButton'

export const IDView = () => {
    const { client } = useClient()
    const stack = useStack()

    if (!client) return null

    return (
        <View>
            <Header>ID管理</Header>
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
                <div>
                    <Tilt glareEnable={true} glareBorderRadius="5%">
                        <Passport
                            ccid={client.ccid}
                            name={client.profile?.username ?? 'No Name'}
                            avatar={client.profile?.avatar ?? ''}
                            host={client.server.domain ?? 'Unknown'}
                            cdate={''}
                        />
                    </Tilt>
                </div>

                <Button
                    startIcon={<MdQrCodeScanner />}
                    onClick={() => {
                        stack.push(
                            <QRSetup
                                onComplete={() => {
                                    setTimeout(() => {
                                        stack.pop()
                                    }, 1000)
                                }}
                            />
                        )
                    }}
                >
                    他デバイスでログイン
                </Button>
                <BackupKeyButton />
            </div>
        </View>
    )
}
