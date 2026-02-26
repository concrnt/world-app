import { QRCode } from 'react-qrcode-logo'
import { Text } from '@concrnt/ui'
import { useState } from 'react'
import { type Identity, GenerateIdentity, ComputeCKID } from '@concrnt/client'

function App() {

    const [identity, _setIdentity] = useState<Identity>(GenerateIdentity())

    const keyID = ComputeCKID(identity.publicKey)

    const [sessionID, _] = useState<string>(crypto.randomUUID())

    const request = {
        type: 'subkey_request',
        key: keyID,
        response: `https://signal.concrnt.net/channel/$${sessionID}`
    }

    return (
        <div>
            <Text variant="h3">{keyID}</Text>
            <div
                style={{
                    width: "200px",
                    height: "200px",
                    margin: '0 auto'
                }}
            >
                <QRCode
                    value={JSON.stringify(request)}
                    size={500}
                    ecLevel="L"
                    quietZone={50}
                    style={{
                        width: '100%',
                        height: '100%'
                    }}
                    fgColor={'black'}
                    bgColor={'transparent'}
                />
            </div>
        </div>
    )
}

export default App
