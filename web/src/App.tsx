import { QRCode } from 'react-qrcode-logo'
import { Text } from '@concrnt/ui'
// import { type Document } from '@concrnt/client'
import { useState } from 'react'

function App() {

    /*
    const doc: Document<any> = {
        schema: 'https://concrnt.com/schemas/document/v1',

    }
    */

    const [sessionID, _] = useState<string>(crypto.randomUUID())

    return (
        <div>
            <Text variant="h3">{sessionID}</Text>
            <QRCode
                value={sessionID}
                size={500}
                ecLevel="L"
                quietZone={50}
                qrStyle="fluid"
                eyeRadius={2}
                style={{
                    width: '100%',
                    height: '100%'
                }}
                fgColor={'black'}
                bgColor={'transparent'}
            />
        </div>
    )
}

export default App
