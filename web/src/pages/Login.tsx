
import { QRCode } from 'react-qrcode-logo'
import { Button, Text, TextField } from '@concrnt/ui'
import { useState } from 'react'
import { type Document, type Identity, GenerateIdentity, ComputeCKID, InMemoryKVS, Api, InMemoryAuthProvider } from '@concrnt/client'
import { usePersistent } from '../hooks/usePersistent'

export const Login = () => {

    const [identity, _setIdentity] = useState<Identity>(GenerateIdentity())

    const [_domain, setDomain] = usePersistent<string>('Domain')
    const [_prvkey, setPrivateKey] = usePersistent<string>('PrivateKey')
    const [_subkey, setSubkey] = usePersistent<string>('SubKey')

    const keyID = ComputeCKID(identity.publicKey)

    const [sessionID, _] = useState<string>(crypto.randomUUID())

    const request = {
        type: 'subkey_request',
        key: keyID,
        response: `https://signal.concrnt.net/channel/$${sessionID}`
    }

    const [domainDraft, setDomainDraft] = useState<string>('v2dev.concrnt.net')

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
        
            <div>
                <Text variant="h3">
                    Developer Option
                </Text>

                <TextField
                    value={domainDraft}
                    onChange={(e) => setDomainDraft(e.target.value)}
                />

                <Button
                    onClick={async () => {
                        const ccid = identity.CCID
                        console.log('Identity:', identity)

                        const domain = domainDraft

                        const authProvider = new InMemoryAuthProvider(identity.privateKey)
                        const kvs = new InMemoryKVS()
                        const api = new Api(domain, authProvider, kvs)

                        const document = {
                            author: ccid,
                            schema: 'https://schema.concrnt.net/affiliation.json',
                            value: {
                                domain
                            },
                            createdAt: new Date().toISOString()
                        }

                        const docString = JSON.stringify(document)
                        const signature = await authProvider.signMaster(docString)

                        const request = {
                            affiliationDocument: docString,
                            affiliationSignature: signature,
                            meta: {}
                        }

                        await api.requestConcrntApi(
                            domain,
                            'net.concrnt.world.register',
                            {},
                            {
                                method: 'POST',
                                body: JSON.stringify(request),
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }
                        )
                        console.log('Registered')

                        const subkeyIdentity = GenerateIdentity()
                        const subkey = `concrnt-subkey ${subkeyIdentity.privateKey} ${ccid}@${domain}`
                        const ckid = ComputeCKID(subkeyIdentity.publicKey)

                        const subkeyDoc: Document<any> = {
                            key: `cckv://${ccid}/keys/${ckid}`,
                            author: ccid,
                            schema: 'https://schema.concrnt.net/subkey.json',
                            value: {
                                ckid
                            },
                            createdAt: new Date()
                        }

                        await api.commit(subkeyDoc, domain, { useMasterkey: true })
                        console.log('Subkey Registered')

                        setDomain(domain)
                        setPrivateKey(identity.privateKey)
                        setSubkey(subkey)

                        window.location.href = '/'
                    }}
                >
                    Quick Setup
                </Button>
            </div>
        </div>
    )
}

