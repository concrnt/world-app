import type { CSSProperties } from 'react'
import type { FieldProps, RJSFSchema, StrictRJSFSchema, UiSchema, WidgetProps } from '@rjsf/utils'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { Suspense, use, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import { Api, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { CssVar, Text } from '@concrnt/ui'
import { AuthActions, AuthButton, AuthScreen, PageHeader, authStyles } from '../components/AuthLayout'

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
    const formShellRef = useRef<HTMLDivElement | null>(null)

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

    const uiSchema = useMemo<UiSchema>(() => {
        return {
            'ui:submitButtonOptions': {
                norender: true
            }
        }
    }, [])

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
                <div style={styles.successWrap}>
                    <Text variant="h2" style={styles.successTitle}>
                        登録完了
                    </Text>
                    <Text style={styles.successDescription}>
                        この画面を閉じて、元のアプリに戻ることができます。
                    </Text>
                </div>
            </AuthScreen>
        )
    }

    return (
        <AuthScreen align="top">
            <RegisterPageStyle />
            <PageHeader title="アカウント登録" description={domain} />

            <div style={authStyles.section}>
                {!hasValidRequest && (
                    <Text style={{ ...authStyles.status, color: '#ff7c7c', opacity: 1 }}>
                        登録リクエストを確認できませんでした。元の画面からもう一度開いてください。
                    </Text>
                )}
            </div>

            <PolicySection title="行動規範" body={codeOfConduct} />
            <PolicySection title="利用規約 / プライバシーポリシー" body={tos} />

            <div style={authStyles.section}>
                <Text variant="h2" style={styles.sectionTitle}>
                    登録フォーム
                </Text>
                <Text style={styles.sectionDescription}>
                    ここで入力する内容は公開プロフィールではありません。サーバーの管理者が登録審査や連絡のために確認する情報です。
                </Text>

                <div className="register-form-shell" ref={formShellRef}>
                    <Form<RJSFSchema, Record<string, unknown>, StrictRJSFSchema>
                        schema={schema}
                        uiSchema={uiSchema}
                        validator={validator}
                        onSubmit={(event) => {
                            void register(event.formData)
                        }}
                        formData={formData}
                        onChange={(event) => setFormData(event.formData)}
                        templates={{
                            FieldTemplate: RegisterFieldTemplate
                        }}
                        widgets={widgets}
                    >
                        {server.meta.captchaSiteKey && (
                            <div style={authStyles.section}>
                                <Text style={{ color: CssVar.uiText }}>reCAPTCHA</Text>
                                <div style={styles.captchaWrap}>
                                    <ReCAPTCHA
                                        sitekey={server.meta.captchaSiteKey}
                                        onChange={(value) => setCaptcha(value ?? '')}
                                    />
                                </div>
                            </div>
                        )}

                        <AuthActions>
                            <AuthButton
                                disabled={!hasValidRequest || (!!server.meta.captchaSiteKey && captcha === '') || processing}
                                onClick={() => formShellRef.current?.querySelector('form')?.requestSubmit()}
                            >
                                {processing ? '登録中...' : '登録する'}
                            </AuthButton>
                        </AuthActions>
                    </Form>
                </div>
            </div>
        </AuthScreen>
    )
}

const RegisterPageStyle = () => {
    return (
        <style>
            {`
                .register-form-shell,
                .register-form-shell form {
                    width: 100%;
                }

                .register-form-shell form {
                    display: flex;
                    flex-direction: column;
                    gap: ${CssVar.space(3)};
                }

                .register-form-shell fieldset {
                    border: none;
                    padding: 0;
                    margin: 0;
                    min-width: 0;
                }
            `}
        </style>
    )
}

const PolicySection = (props: { title: string; body: string }) => {
    return (
        <div style={authStyles.section}>
            <Text variant="h2" style={styles.sectionTitle}>
                {props.title}
            </Text>
            <div style={styles.policyBody}>
                <Text style={styles.policyText}>{props.body}</Text>
            </div>
        </div>
    )
}

const RegisterFieldTemplate = (props: FieldProps) => {
    const { id, classNames, label, help, required, description, errors, children, hidden, schema } = props

    if (hidden) {
        return <div style={{ display: 'none' }}>{children}</div>
    }

    const showLabel = schema.type !== 'boolean' && label && label !== 'root'

    return (
        <div className={classNames} style={authStyles.inputGroup}>
            {showLabel && (
                <label htmlFor={id}>
                    <Text style={{ color: CssVar.uiText }}>
                        {label}
                        {required ? ' *' : ''}
                    </Text>
                </label>
            )}
            {description}
            {children}
            {help}
            {errors}
        </div>
    )
}

const TextWidget = (props: WidgetProps) => {
    const { id, value, required, disabled, readonly, autofocus, placeholder, onChange, onBlur, onFocus, options } = props
    const inputType = (options.inputType as string | undefined) ?? 'text'

    return (
        <input
            id={id}
            type={inputType}
            autoFocus={autofocus}
            required={required}
            disabled={disabled || readonly}
            placeholder={placeholder}
            value={typeof value === 'string' ? value : value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => onBlur(id, event.target.value)}
            onFocus={(event) => onFocus(id, event.target.value)}
            style={styles.input}
        />
    )
}

const TextareaWidget = (props: WidgetProps) => {
    const { id, value, required, disabled, readonly, autofocus, placeholder, onChange, onBlur, onFocus } = props

    return (
        <textarea
            id={id}
            autoFocus={autofocus}
            required={required}
            disabled={disabled || readonly}
            placeholder={placeholder}
            value={typeof value === 'string' ? value : value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => onBlur(id, event.target.value)}
            onFocus={(event) => onFocus(id, event.target.value)}
            style={styles.textarea}
        />
    )
}

const SelectWidget = (props: WidgetProps) => {
    const { id, value, required, disabled, readonly, placeholder, onChange, onBlur, onFocus, options } = props

    return (
        <select
            id={id}
            required={required}
            disabled={disabled || readonly}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => onBlur(id, event.target.value)}
            onFocus={(event) => onFocus(id, event.target.value)}
            style={styles.select}
        >
            <option value="" disabled>
                {placeholder ?? '選択してください'}
            </option>
            {Array.isArray(options.enumOptions) &&
                options.enumOptions.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                        {option.label}
                    </option>
                ))}
        </select>
    )
}

const CheckboxWidget = (props: WidgetProps) => {
    const { id, value, disabled, readonly, label, onChange, onBlur, onFocus } = props

    return (
        <label htmlFor={id} style={styles.checkboxRow}>
            <input
                id={id}
                type="checkbox"
                checked={Boolean(value)}
                disabled={disabled || readonly}
                onChange={(event) => onChange(event.target.checked)}
                onBlur={(event) => onBlur(id, event.target.checked)}
                onFocus={(event) => onFocus(id, event.target.checked)}
            />
            <Text style={{ color: CssVar.uiText }}>{label}</Text>
        </label>
    )
}

const widgets = {
    TextWidget,
    EmailWidget: TextWidget,
    PasswordWidget: (props: WidgetProps) => <TextWidget {...props} options={{ ...props.options, inputType: 'password' }} />,
    URLWidget: TextWidget,
    TextareaWidget,
    SelectWidget,
    CheckboxWidget
}

const styles: Record<string, CSSProperties> = {
    sectionTitle: {
        color: CssVar.uiText,
        fontSize: '1.5rem',
        lineHeight: 1.3,
        margin: 0,
        textAlign: 'left'
    },
    successWrap: {
        width: '100%',
        minHeight: '50dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: CssVar.space(2)
    },
    successTitle: {
        color: CssVar.uiText,
        margin: 0,
        fontSize: '1.8rem',
        lineHeight: 1.3
    },
    successDescription: {
        color: CssVar.uiText,
        opacity: 0.78,
        margin: 0,
        lineHeight: 1.7
    },
    policyBody: {
        width: '100%',
        maxHeight: 240,
        overflowY: 'auto',
        padding: CssVar.space(3),
        boxSizing: 'border-box',
        border: `1px solid ${CssVar.divider}`,
        borderRadius: CssVar.round(2),
        backgroundColor: CssVar.contentBackground
    },
    policyText: {
        color: CssVar.contentText,
        lineHeight: 1.7,
        margin: 0
    },
    sectionDescription: {
        color: CssVar.uiText,
        opacity: 0.78,
        lineHeight: 1.6,
        fontSize: '0.95rem',
        margin: 0,
        textAlign: 'left'
    },
    captchaWrap: {
        overflowX: 'auto'
    },
    input: {
        padding: CssVar.space(2),
        fontSize: '16px',
        borderRadius: CssVar.round(1),
        borderColor: CssVar.divider,
        backgroundColor: CssVar.contentBackground,
        color: CssVar.contentText,
        width: '100%',
        boxSizing: 'border-box'
    },
    textarea: {
        padding: CssVar.space(2),
        fontSize: '16px',
        borderRadius: CssVar.round(1),
        borderColor: CssVar.divider,
        backgroundColor: CssVar.contentBackground,
        color: CssVar.contentText,
        width: '100%',
        minHeight: 120,
        resize: 'vertical',
        boxSizing: 'border-box'
    },
    select: {
        padding: CssVar.space(2),
        fontSize: '16px',
        borderRadius: CssVar.round(1),
        borderColor: CssVar.divider,
        backgroundColor: CssVar.contentBackground,
        color: CssVar.contentText,
        width: '100%',
        boxSizing: 'border-box'
    },
    checkboxRow: {
        display: 'flex',
        alignItems: 'center',
        gap: CssVar.space(2)
    }
}
