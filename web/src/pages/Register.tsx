import type { RJSFSchema } from '@rjsf/utils'
import { Suspense, use, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Api, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { Text } from '@concrnt/ui'
import { AuthScreen, PageHeader, authStyles } from '../components/AuthLayout'
import { RegisterFormSection, RegisterPolicySection, RegisterSuccess } from '../components/register/RegisterForm'

interface RegisterServer {
    domain: string
    meta: {
        captchaSiteKey?: string
    }
}

export const Register = () => {
    const serverPromise = useMemo(() => {
        return fetch('.well-known/concrnt').then((response) => {
            if (response.ok) {
                return response.json() as Promise<RegisterServer>
            }

            throw new Error('Something went wrong')
        })
    }, [])

    const tosPromise = useMemo(() => {
        return fetch('/tos').then((response) => {
            if (response.ok) {
                return response.text()
            }

            throw new Error('Something went wrong')
        })
    }, [])

    const codeOfConductPromise = useMemo(() => {
        return fetch('/code-of-conduct').then((response) => {
            if (response.ok) {
                return response.text()
            }

            throw new Error('Something went wrong')
        })
    }, [])

    const schemaPromise = useMemo(() => {
        return fetch('/register-template').then((response) => {
            if (response.ok) {
                return response.json()
            }

            throw new Error('Something went wrong')
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

const Inner = (props: {
    serverPromise: Promise<RegisterServer>
    tosPromise: Promise<string>
    codeOfConductPromise: Promise<string>
    schemaPromise: Promise<RJSFSchema>
}) => {
    const server = use(props.serverPromise)
    const domain = server.domain
    const tos = use(props.tosPromise)
    const codeOfConduct = use(props.codeOfConductPromise)
    const schema = use(props.schemaPromise)

    const [searchParams] = useSearchParams()
    const [processing, setProcessing] = useState(false)
    const [success, setSuccess] = useState(false)
    const [captcha, setCaptcha] = useState('')
    const [formData, setFormData] = useState<Record<string, unknown>>({})

    const encodedDocument = searchParams.get('document')
    const registration = encodedDocument ? atob(encodedDocument.replace('-', '+').replace('_', '/')) : null
    const signature = searchParams.get('signature')
    const callback = searchParams.get('callback')

    const signedObj = useMemo(() => {
        if (!registration) return null

        try {
            return JSON.parse(registration)
        } catch {
            return null
        }
    }, [registration])

    const hasValidRequest = Boolean(registration && signature && signedObj)

    const register = async (meta: Record<string, unknown>) => {
        if (!registration || !signature) return

        setProcessing(true)

        try {
            const authProvider = new InMemoryAuthProvider(undefined, undefined)
            const kvs = new InMemoryKVS()
            const api = new Api(domain, authProvider, kvs)

            const request = {
                document: registration,
                proof: {
                    type: 'concrnt-ecrecover-direct',
                    signature
                },
                meta
            }

            await api.requestConcrntApi(domain, 'net.concrnt.world.register', {}, {
                method: 'POST',
                body: JSON.stringify(request),
                headers: {
                    'Content-Type': 'application/json',
                    captcha
                }
            })

            setSuccess(true)

            setTimeout(() => {
                if (callback) {
                    window.location.href = callback
                } else {
                    window.close()
                }
            }, 1000)
        } finally {
            setProcessing(false)
        }
    }

    if (success) {
        return (
            <AuthScreen align="top">
                <PageHeader title="アカウント登録" description={domain} />
                <RegisterSuccess />
            </AuthScreen>
        )
    }

    return (
        <AuthScreen align="top">
            <PageHeader title="アカウント登録" description={domain} />

            <div style={authStyles.section}>
                {!hasValidRequest && (
                    <Text style={{ ...authStyles.status, color: '#ff7c7c', opacity: 1 }}>
                        登録リクエストを確認できませんでした。元の画面からもう一度開いてください。
                    </Text>
                )}
            </div>

            <RegisterPolicySection title="行動規範" body={codeOfConduct} />
            <RegisterPolicySection title="利用規約 / プライバシーポリシー" body={tos} />
            <RegisterFormSection
                schema={schema}
                siteKey={server.meta.captchaSiteKey}
                formData={formData}
                captcha={captcha}
                processing={processing}
                hasValidRequest={hasValidRequest}
                onCaptchaChange={setCaptcha}
                onChange={setFormData}
                onSubmit={(value) => {
                    void register(value)
                }}
            />
        </AuthScreen>
    )
}
