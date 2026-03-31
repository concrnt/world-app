import type { RJSFSchema } from '@rjsf/utils'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { useSearchParams } from 'react-router-dom'
import { Suspense, use, useMemo, useState } from 'react'
import ReCAPTCHA from "react-google-recaptcha";
import { Api, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { Text } from '@concrnt/ui'

export const Register = () => {

    const serverPromise = useMemo(() => {
        return fetch('.well-known/concrnt')
        .then(response => {
            if (response.ok) {
                console.log('response', response)
                return response.json()
            } else {
                throw new Error('Something went wrong')
            }
        })
    }, [])

    const tosPromise = useMemo(() => {
        return fetch(`/tos`, {
            method: 'GET',
        }).then(response => {
            if (response.ok) {
                return response.text()
            } else {
                throw new Error('Something went wrong')
            }
        })
    }, [])

    const codeOfConductPromise = useMemo(() => {
        return fetch(`/code-of-conduct`, {
            method: 'GET',
        }).then(response => {
            if (response.ok) {
                return response.text()
            } else {
                throw new Error('Something went wrong')
            }
        })
    }, [])

    const schemaPromise = useMemo(() => {
        return fetch(`/register-template`, {
            method: 'GET',
        }).then(response => {
            if (response.ok) {
                return response.json()
            } else {
                throw new Error('Something went wrong')
            }
        })
    }, [])

    return (
        <Suspense>
            <Inner
                serverPromise={serverPromise}
                tosPromise={tosPromise}
                codeOfConductPromise={codeOfConductPromise}
                schemaPromise={schemaPromise}
            />
        </Suspense>
    )
}

export const Inner = (props: {
    serverPromise: Promise<any>
    tosPromise: Promise<string>
    codeOfConductPromise: Promise<string>
    schemaPromise: Promise<RJSFSchema>
}) => {

    const server = use(props.serverPromise)
    const domain = server.domain
    const tos = use(props.tosPromise)
    const codeofconduct = use(props.codeOfConductPromise)
    const schema = use(props.schemaPromise)

    const [searchParams] = useSearchParams()
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [captcha, setCaptcha] = useState<string>("")
    const [formData, setFormData] = useState<any>({})

    const encodedDocument = searchParams.get('document')
    const registration = encodedDocument ? atob(encodedDocument.replace('-', '+').replace('_', '/')) : null
    const signature = searchParams.get('signature')
    const callback = searchParams.get('callback')

    let ccaddr = ""
    if (registration) {
        const signedObj = JSON.parse(registration)
        ccaddr = signedObj.author
    }

    console.log('registration', registration)
    console.log('signature', signature)

    const register = async (meta: any) => {

        setProcessing(true)

        const authProvider = new InMemoryAuthProvider(undefined, undefined)
        const kvs = new InMemoryKVS()

        const api = new Api(domain, authProvider, kvs)

        const request = {
            affiliationDocument: registration,
            affiliationSignature: signature,
            meta: meta,
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

        setSuccess(true)

        if (callback) {
            setTimeout(() => {
                window.location.href = callback
            }, 1000)
        }
    }

    if (success) {
        return <>
            <Text variant="h1">登録完了</Text>
            {callback && <Text>元のページに戻ります...</Text>}
        </>
    }

    return <>
        <Text>welcome {ccaddr}!</Text>
        <Text variant="h1">登録</Text>
        <Text variant="h2">行動規範</Text>
        <div
            style={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
            }}
        >
            {codeofconduct}
        </div>
        <Text variant="h2">利用規約およびプライバシーポリシー</Text>
        <div
            style={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                maxHeight: '200px',
                overflowY: 'scroll',
            }}
        >
            {tos}
        </div>
        <Form
            schema={schema}
            validator={validator}
            onSubmit={(e) => {register(e.formData)}}
            formData={formData}
            onChange={(e) => setFormData(e.formData)}
        >
            {server.meta.captchaSiteKey &&
                <ReCAPTCHA
                    sitekey={server.meta.captchaSiteKey}
                    onChange={(e) => setCaptcha(e ?? '')}
                />
            }
            <button
                type='submit'
                disabled={(!!server.meta.captchaSiteKey) && (captcha === "") || processing}
            >
                Submit
            </button>
        </Form>
        <hr/>
        <pre>
            {JSON.stringify(server, null, 4)}
        </pre>
    </>
}

