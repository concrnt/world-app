import {
    Api,
    ComputeCKID,
    DeriveIdentity,
    type Document,
    GenerateIdentity,
    InMemoryAuthProvider,
    InMemoryKVS
} from '@concrnt/client'
import { Button, CssVar, Passport, Text } from '@concrnt/ui'
import { emojihash, type ProfileSchema, semantics, SignalLoginReceiver } from '@concrnt/worldlib'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCode } from 'react-qrcode-logo'
import { usePersistent } from '../hooks/usePersistent'
import { string2Uint8Array } from '../util'
import Tilt from 'react-parallax-tilt'

export const QRSetup = () => {
    const { t } = useTranslation('', { keyPrefix: 'web.qrSetup' })
    const [sessionID, _] = useState<string>(crypto.randomUUID())
    const signalURL = `wss://signal.concrnt.net/${sessionID}`

    const [ccid, setCCID] = useState<string>('')
    const [domain, setDomain] = useState<string>('')

    const [profile, setProfile] = useState<Document<ProfileSchema> | null>(null)

    const [keyFingerprint, setKeyFingerprint] = useState<string>()

    const [_domain, setPersistentDomain] = usePersistent<string>('Domain')
    const [_subkey, setPersistentSubkey] = usePersistent<string>('SubKey')

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
            setDomain((d = domain))

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

                // @ts-expect-error - TypeScript does not yet recognize the prf extension results
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

        const receiver = new SignalLoginReceiver(signalURL, keyGenerationCallback, (keyURI: string) => {
            setPersistentDomain(d)
            setPersistentSubkey(subkey)

            window.location.href = '/'
        })

        return () => {
            receiver.dispose()
        }
    }, [signalURL])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: CssVar.space(4),
                width: '100%',
                maxWidth: 420,
                margin: '0 auto'
            }}
        >
            <div
                style={{
                    width: 'min(220px, 70vw)',
                    aspectRatio: '1 / 1',
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
                    fgColor={'white'}
                    bgColor={'transparent'}
                    qrStyle="fluid"
                    eyeRadius={10}
                />
            </div>

            <div
                style={{
                    width: '100%',
                    maxWidth: 380,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: CssVar.space(3),
                    textAlign: 'center'
                }}
            >
                {!ccid && <Text>{t('scanWithApp')}</Text>}

                {pendingKeyGeneration && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: CssVar.space(2),
                            width: '100%'
                        }}
                    >
                        <Text variant="h4">{t('usePasskeyTitle')}</Text>
                        <Text>{t('usePasskeyDescription')}</Text>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: CssVar.space(2),
                                flexWrap: 'wrap'
                            }}
                        >
                            <Button
                                onClick={() => {
                                    if (keyTypeSelectionRef.current) {
                                        keyTypeSelectionRef.current('instant')
                                    }
                                }}
                            >
                                {t('no')}
                            </Button>
                            <Button
                                onClick={() => {
                                    if (keyTypeSelectionRef.current) {
                                        keyTypeSelectionRef.current('passkey')
                                    }
                                }}
                            >
                                {t('yes')}
                            </Button>
                        </div>
                    </div>
                )}

                {ccid && domain && !pendingKeyGeneration && (
                    <div
                        style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: CssVar.space(2)
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                maxWidth: 360
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
                        <Text style={{ fontSize: '2rem' }}>{keyFingerprint}</Text>
                        <Text>{t('confirmEmoji')}</Text>
                    </div>
                )}
            </div>
        </div>
    )
}
