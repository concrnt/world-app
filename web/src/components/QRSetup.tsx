import { Api, ComputeCKID, DeriveIdentity, type Document, GenerateIdentity, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { Button, CssVar, Passport, Text } from '@concrnt/ui'
import { emojihash, type ProfileSchema, semantics, SignalLoginReceiver } from '@concrnt/worldlib'
import { useEffect, useMemo, useRef, useState } from 'react'
import { QRCode } from 'react-qrcode-logo'
import { usePersistent } from '../hooks/usePersistent'
import { string2Uint8Array } from '../util'
import Tilt from 'react-parallax-tilt'

export const QRSetup = () => {
    const sessionID = useMemo(() => crypto.randomUUID(), [])
    const signalURL = `wss://signal.concrnt.net/${sessionID}`

    const [ccid, setCCID] = useState<string>('')
    const [domain, setDomain] = useState<string>('')

    const [profile, setProfile] = useState<Document<ProfileSchema> | null>(null)

    const [keyFingerprint, setKeyFingerprint] = useState<string>()

    const [, setPersistentDomain] = usePersistent<string>('Domain')
    const [, setPersistentSubkey] = usePersistent<string>('SubKey')

    const keyTypeSelectionRef = useRef<((typ: 'instant' | 'passkey') => void) | null>(null)
    const [pendingKeyGeneration, setPendingKeyGeneration] = useState<{ ccid: string; domain: string } | null>(null)

    const waitForKeyTypeSelection = (ccid: string, domain: string): Promise<'instant' | 'passkey'> => {
        setPendingKeyGeneration({ ccid, domain })
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

            const authProvider = new InMemoryAuthProvider()
            const kvs = new InMemoryKVS()
            const api = new Api(domain, authProvider, kvs)

            api.getDocument<ProfileSchema>(semantics.profile(ccid, 'main'), domain).then((doc) => {
                if (doc) {
                    setProfile(doc)
                }
            })

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

                const credentialResults = (
                    cred as PublicKeyCredential & {
                        getClientExtensionResults: () => AuthenticationExtensionsClientOutputs & {
                            prf?: {
                                results?: {
                                    first?: ArrayBuffer
                                }
                            }
                        }
                    }
                ).getClientExtensionResults()
                console.log('Credential Results:', credentialResults)

                const prfRes = credentialResults?.prf?.results
                if (!prfRes?.first) {
                    console.error('PRF results not available')
                    throw new Error('PRF results not available')
                }
                console.log('PRF First:', prfRes.first)

                const firstBuf = prfRes.first instanceof ArrayBuffer ? new Uint8Array(prfRes.first) : new Uint8Array(prfRes.first.buffer)
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
            () => {
                setPersistentDomain(d)
                setPersistentSubkey(subkey)

                window.location.href = '/'
            }
        )

        return () => {
            receiver.dispose()
        }

    }, [setPersistentDomain, setPersistentSubkey, signalURL])

    return <div
        style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >

        <div>
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

        </div>

        <div>

            {!ccid &&
                <Text>Concrntアプリで<wbr/>QRコードをスキャンしてください</Text>
            }

            {pendingKeyGeneration && 
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: CssVar.space(2),
                    }}
            >
                    <Text variant="h4">パスキーを利用しますか？</Text>
                    <Text>
                        パスキーがおすすめですが、一部の端末やブラウザでは利用できない場合があります。
                    </Text>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: CssVar.space(2),
                        }}
                    >
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
                </div>
            }

            {ccid && domain && !pendingKeyGeneration &&
                <div>
                    <div
                        style={{
                            width: '40vw',
                        }}
                    >
                        <Tilt glareEnable={true} glareBorderRadius="5%">
                            <Passport
                                ccid={ccid}
                                name={profile?.value.username ?? 'No Name'}
                                avatar={profile?.value.avatar ?? ''}
                                host={domain ?? 'Unknown'}
                                cdate={''}
                            />
                        </Tilt>
                    </div>
                    <Text style={{fontSize: '2rem'}}>{keyFingerprint}</Text>
                    <Text>端末で表示されている絵文字を確認し、同じであれば端末で「はい」を選択してください。</Text>
                </div>
            }

        </div>
    </div>
}
