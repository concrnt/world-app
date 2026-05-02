
import { ComputeCKID, type Identity } from "@concrnt/client"
import { Text } from "@concrnt/ui"
import { SignalLoginReceiver } from "@concrnt/worldlib"
import { useEffect, useState } from "react"
import { QRCode } from 'react-qrcode-logo'
import { usePersistent } from "../hooks/usePersistent"


interface Props {
    identity: Identity
}

export const QRSetup = (props: Props) => {

    const [sessionID, _] = useState<string>(crypto.randomUUID())
    const signalURL = `wss://signal.concrnt.net/${sessionID}`

    const [ccid, setCCID] = useState<string>('')
    const [domain, setDomain] = useState<string>('')

    const [keyURI, setKeyURI] = useState<string>('')

    const [_domain, setPersistentDomain] = usePersistent<string>('Domain')
    const [_prvkey, setPersistentPrivateKey] = usePersistent<string>('PrivateKey')
    const [_subkey, setPersistentSubkey] = usePersistent<string>('SubKey')

    useEffect(() => {

        let c = ''
        let d = ''

        const keyGenerationCallback = async (ccid: string, domain: string): Promise<string> => {
            setCCID(c = ccid)
            setDomain(d = domain)
            const keyID = ComputeCKID(props.identity.publicKey)
            return keyID
        }

        const receiver = new SignalLoginReceiver(
            signalURL,
            keyGenerationCallback,
            (keyURI: string) => {
                setKeyURI(keyURI)

                const subkey = `concrnt-subkey ${props.identity.privateKey} ${c}@${d}`

                setPersistentDomain(d)
                setPersistentPrivateKey(props.identity.privateKey)
                setPersistentSubkey(subkey)

                window.location.href = '/'
            }
        )

        return () => {
            receiver.dispose()
        }

    }, [signalURL, props.identity])

    return <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >

        <div
            style={{
                width: "200px",
                height: "200px",
                margin: '0 auto'
            }}
        >
            <QRCode
                value={signalURL}
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
        <Text>{sessionID}</Text>
        <Text>CCID: {ccid}</Text>
        <Text>Domain: {domain}</Text>
        <Text>Key URI: {keyURI}</Text>
    </div>


}


