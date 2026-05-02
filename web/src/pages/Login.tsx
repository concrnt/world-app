
import { useEffect } from 'react'
import { QRSetup } from '../components/QRSetup'
import { string2Uint8Array } from '../util'
import { Api, DeriveIdentity, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'

export const Login = () => {


    useEffect(() => {
        // receive passkey
        const run = async () => {
            const challenge = new Uint8Array(32)
            crypto.getRandomValues(challenge)
            const cred = await navigator.credentials.get({
                publicKey: {
                    challenge: challenge,
                    rpId: window.location.hostname,
                    userVerification: 'required',
                    extensions: {
                        prf: {
                            eval: {
                                first: string2Uint8Array('concrnt-world-passkey')
                            }
                        }
                    }
                }
            })

            console.log('cred', cred)
            if (!cred) {
                console.error('Failed to get passkey')
                // enqueueSnackbar('Failed to get passkey.', { variant: 'error' })
                alert('Failed to get passkey.')
                return
            }

            // @ts-ignore
            const userHandle = cred.response?.userHandle
            if (!userHandle) {
                console.error('No user handle found in passkey response')
                // enqueueSnackbar('No user handle found in passkey response.', { variant: 'error' })
                alert('No user handle found in passkey response.')
                return
            }

            let ccid = new TextDecoder().decode(userHandle)
            let domain = 'cc2.tunnel.anthrotech.dev'
            const split = ccid.split('@')
            if (split.length === 2) {
                ccid = split[0]
                domain = split[1]
            }

            const authProvider = new InMemoryAuthProvider()
            const kvs = new InMemoryKVS()
            const api = new Api(domain, authProvider, kvs)

            const entity = await api.getEntity(ccid)
            if (!entity) {
                console.error('No entity found for CCID:', ccid)
                alert('No entity found for provided passkey.')
                return
            }
            domain = entity.value.domain

            // @ts-ignore
            const credentialResults = cred.getClientExtensionResults()
            console.log('Credential Results:', credentialResults)
            const prfRes = credentialResults?.prf?.results
            if (!prfRes?.first) {
                console.error('No PRF first result found')
                alert('Provided passkey is not supported.')
                return
            }

            console.log('PRF First:', prfRes.first)
            const firstBuf = new Uint8Array(prfRes.first)
            console.log('source:', prfRes.first)

            const identity = DeriveIdentity(firstBuf)
            console.log('Derived Identity:', identity)


            const subkeyStr = `concrnt-subkey ${identity.privateKey} ${ccid}@${domain} -`

            localStorage.setItem('Domain', JSON.stringify(domain))
            localStorage.setItem('SubKey', JSON.stringify(subkeyStr))
            window.location.href = '/'
        }

        run()
    }, [])

    return (
        <div>
            <QRSetup
            />
        </div>
    )
}

