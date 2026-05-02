
import { ComputeCKID, DeriveIdentity, GenerateIdentity } from "@concrnt/client"
import { Button, Text } from "@concrnt/ui"
import { emojihash, SignalLoginReceiver } from "@concrnt/worldlib"
import { useEffect, useRef, useState } from "react"
import { QRCode } from 'react-qrcode-logo'
import { usePersistent } from "../hooks/usePersistent"
import { string2Uint8Array } from "../util"

export const QRSetup = () => {

    const [sessionID, _] = useState<string>(crypto.randomUUID())
    const signalURL = `wss://signal.concrnt.net/${sessionID}`

    const [ccid, setCCID] = useState<string>('')
    const [domain, setDomain] = useState<string>('')

    const [keyFingerprint, setKeyFingerprint] = useState<string>()
    const [keyURI, setKeyURI] = useState<string>('')

    const [_domain, setPersistentDomain] = usePersistent<string>('Domain')
    const [_subkey, setPersistentSubkey] = usePersistent<string>('SubKey')

    const keyTypeSelectionRef = useRef<((typ: 'instant' | 'passkey') => void) | null>(null)
    const [pendingKeyGeneration, setPendingKeyGeneration] = useState<{ccid: string, domain: string} | null>(null)

    const waitForKeyTypeSelection = (ccid: string, domain: string): Promise<'instant' | 'passkey'> => {
        setPendingKeyGeneration({ccid, domain})
        return new Promise((resolve) => {
            keyTypeSelectionRef.current = (typ: 'instant' | 'passkey') => {
                resolve(typ)
                keyTypeSelectionRef.current = null
                setPendingKeyGeneration(null)
            }
        })
    }


    useEffect(() => {

        let d = ''
        let subkey = ''

        const keyGenerationCallback = async (ccid: string, domain: string): Promise<string> => {
            setCCID(ccid)
            setDomain(d = domain)

            const keyType = await waitForKeyTypeSelection(ccid, domain)
            
            console.log('Selected key type:', keyType)

            if (keyType === 'passkey') {

                let id = `${ccid}@${domain}`
                if (id.length > 64) {
                    id = ccid
                }

                const challenge = new Uint8Array(32)
                crypto.getRandomValues(challenge)
                const cred = await navigator.credentials.create({
                    publicKey: {
                        challenge: challenge,
                        rp: {
                            name: 'concrnt.world',
                            id: window.location.hostname
                        },
                        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                        user: {
                            id: string2Uint8Array(id),
                            name: ccid,
                            displayName: 'concrnt' 
                        },
                        authenticatorSelection: {
                            userVerification: 'required',
                            residentKey: 'required'
                        },
                        extensions: {
                            prf: {
                                eval: {
                                    first: string2Uint8Array('concrnt-world-passkey')
                                }
                            }
                        }
                    }
                })

                if (!cred) {
                    console.error('Credential creation failed')
                    throw new Error('Failed to create credential')
                }

                //@ts-ignore
                const credentialResults = cred.getClientExtensionResults()
                console.log('Credential Results:', credentialResults)

                const prfRes = credentialResults?.prf?.results
                if (!prfRes?.first) {
                    console.error('PRF results not available')
                    throw new Error('PRF results not available')
                }
                console.log('PRF First:', prfRes.first)

                const firstBuf = new Uint8Array(prfRes.first)
                const identity = DeriveIdentity(firstBuf)

                const keyID = ComputeCKID(identity.publicKey)
                setKeyFingerprint(emojihash(keyID))
                subkey = `concrnt-subkey ${identity.privateKey} ${ccid}@${domain}`

                return keyID

            } else {

                const identity = GenerateIdentity()
                const keyID = ComputeCKID(identity.publicKey)
                setKeyFingerprint(emojihash(keyID))
                subkey = `concrnt-subkey ${identity.privateKey} ${ccid}@${domain}`

                return keyID
            }

        }

        const receiver = new SignalLoginReceiver(
            signalURL,
            keyGenerationCallback,
            (keyURI: string) => {
                setKeyURI(keyURI)

                setPersistentDomain(d)
                setPersistentSubkey(subkey)

                window.location.href = '/'
            }
        )

        return () => {
            receiver.dispose()
        }

    }, [signalURL])

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
        <Text>Key Fingerprint: {keyFingerprint}</Text>


        {pendingKeyGeneration && 
            <div>
                <Text>パスキーを利用しますか？</Text>
                <Button
                    onClick={() => {
                        if (keyTypeSelectionRef.current) {
                            keyTypeSelectionRef.current('instant')
                        }
                    }}
                >
                    いいえ
                </Button>
                <Button
                    onClick={() => {
                        if (keyTypeSelectionRef.current) {
                            keyTypeSelectionRef.current('passkey')
                        }
                    }}
                >
                    はい
                </Button>
            </div>
        }

        {ccid && domain && !pendingKeyGeneration &&
            <div>
                <Text>端末で表示されている絵文字を確認し、同じであれば「はい」を選択してください。</Text>
            </div>
        }


    </div>
}


