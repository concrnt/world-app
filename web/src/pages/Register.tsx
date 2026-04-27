import type { ChangeEvent, CSSProperties, FocusEvent, ReactNode } from 'react'
import type { FieldProps, RJSFSchema, StrictRJSFSchema, UiSchema, WidgetProps } from '@rjsf/utils'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { Suspense, use, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import { Api, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { Button, ConcrntLogo, CssVar, Text } from '@concrnt/ui'

export const Register = () => {
    const serverPromise = useMemo(() => {
        return fetch('.well-known/concrnt').then((response) => {
            if (response.ok) {
                return response.json()
            }

            throw new Error('Something went wrong')
        })
    }, [])

    const tosPromise = useMemo(() => {
        return fetch('/tos', {
            method: 'GET'
        }).then((response) => {
            if (response.ok) {
                return response.text()
            }

            throw new Error('Something went wrong')
        })
    }, [])

    const codeOfConductPromise = useMemo(() => {
        return fetch('/code-of-conduct', {
            method: 'GET'
        }).then((response) => {
            if (response.ok) {
                return response.text()
            }

            throw new Error('Something went wrong')
        })
    }, [])

    const schemaPromise = useMemo(() => {
        return fetch('/register-template', {
            method: 'GET'
        }).then((response) => {
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

export const Inner = (props: {
    serverPromise: Promise<any>
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
    const [formData, setFormData] = useState<any>({})
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

    const ccaddr = signedObj?.author ?? ''
    const hasValidRequest = Boolean(registration && signature && signedObj)

    const uiSchema = useMemo<UiSchema>(() => {
        return {
            'ui:submitButtonOptions': {
                norender: true
            }
        }
    }, [])

    const register = async (meta: any) => {
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
                    'captcha': captcha
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
                        {callback
                            ? 'この画面を閉じて、元のアプリに戻ることができます。'
                            : 'この画面を閉じて、元のアプリに戻ることができます。'}
                    </Text>
                </div>
            </AuthScreen>
        )
    }

    return (
        <AuthScreen align="top">
            <RegisterPageStyle />
            <PageHeader
                title="アカウント登録"
                description={domain}
            />

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
                    <Form<RJSFSchema, any, StrictRJSFSchema>
                        schema={schema}
                        uiSchema={uiSchema}
                        validator={validator}
                        onSubmit={(e) => {
                            void register(e.formData)
                        }}
                        formData={formData}
                        onChange={(e) => setFormData(e.formData)}
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

const PageHeader = (props: { title: string; description?: ReactNode; brandOnly?: boolean }) => {
    return (
        <div style={styles.pageHeaderWrap}>
            <div style={styles.pageHeader}>
                <div style={styles.brandRow}>
                    <ConcrntLogo
                        size="36px"
                        upperColor={CssVar.uiText}
                        lowerColor={CssVar.uiText}
                        frameColor={CssVar.uiText}
                    />
                    <Text style={styles.wordmark}>Concrnt</Text>
                </div>
                <div style={styles.pageHeaderText}>
                    <AuthHeader title={props.title} compact={props.brandOnly} />
                </div>
            </div>
            {props.description && <Text style={styles.pageHeaderMeta}>{props.description}</Text>}
        </div>
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
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onBlur(id, e.target.value)}
            onFocus={(e) => onFocus(id, e.target.value)}
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
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onBlur(id, e.target.value)}
            onFocus={(e) => onFocus(id, e.target.value)}
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
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onBlur(id, e.target.value)}
            onFocus={(e) => onFocus(id, e.target.value)}
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
                onChange={(e) => onChange(e.target.checked)}
                onBlur={(e) => onBlur(id, e.target.checked)}
                onFocus={(e) => onFocus(id, e.target.checked)}
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

const AuthScreen = (props: { children: ReactNode; align?: 'center' | 'top' }) => {
    return (
        <div
            style={{
                minHeight: '100dvh',
                width: '100dvw',
                padding: `calc(env(safe-area-inset-top) + ${CssVar.space(8)}) ${CssVar.space(5)} calc(env(safe-area-inset-bottom) + ${CssVar.space(5)})`,
                color: CssVar.uiText,
                backgroundColor: CssVar.uiBackground,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: props.align === 'top' ? 'flex-start' : 'center',
                overflowY: 'auto',
                boxSizing: 'border-box'
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 440,
                    minHeight: props.align === 'top' ? 'auto' : 520,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: props.align === 'top' ? 'flex-start' : 'center',
                    gap: CssVar.space(5)
                }}
            >
                {props.children}
            </div>
        </div>
    )
}

const AuthHeader = (props: { title: string; description?: ReactNode; compact?: boolean }) => {
    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                textAlign: 'right',
                gap: CssVar.space(1)
            }}
        >
            <Text
                variant="h1"
                style={{
                    color: CssVar.uiText,
                    fontSize: props.compact ? '1.35rem' : '1.45rem',
                    lineHeight: 1.2,
                    margin: 0
                }}
            >
                {props.title}
            </Text>
            {props.description && (
                <Text
                    style={{
                        color: CssVar.uiText,
                        opacity: 0.78,
                        lineHeight: 1.6,
                        fontSize: '0.95rem',
                        margin: 0
                    }}
                >
                    {props.description}
                </Text>
            )}
        </div>
    )
}

const AuthActions = (props: { children: ReactNode; fixedBottom?: boolean }) => {
    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: CssVar.space(3),
                marginTop: props.fixedBottom ? 'auto' : CssVar.space(2)
            }}
        >
            {props.children}
        </div>
    )
}

const AuthButton = (props: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
}) => {
    return (
        <Button
            disabled={props.disabled}
            onClick={props.onClick}
            style={{
                width: '100%',
                minHeight: 48,
                color: CssVar.uiBackground,
                backgroundColor: CssVar.uiText,
                border: 'none',
                fontSize: '1rem',
                fontWeight: 700
            }}
        >
            {props.children}
        </Button>
    )
}

const authStyles = {
    section: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: CssVar.space(3)
    } satisfies CSSProperties,
    inputGroup: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: CssVar.space(2)
    } satisfies CSSProperties,
    status: {
        minHeight: 24,
        color: CssVar.uiText,
        opacity: 0.78
    } satisfies CSSProperties,
}

const styles: Record<string, CSSProperties> = {
    sectionTitle: {
        color: CssVar.uiText,
        fontSize: '1.5rem',
        lineHeight: 1.3,
        margin: 0,
        textAlign: 'left'
    },
    pageHeader: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: CssVar.space(3)
    },
    pageHeaderWrap: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: CssVar.space(1)
    },
    brandRow: {
        display: 'flex',
        alignItems: 'center',
        gap: CssVar.space(2),
        flexShrink: 0,
        minHeight: 36
    },
    wordmark: {
        fontSize: '28px',
        lineHeight: 1,
        color: CssVar.uiText,
        fontWeight: 700,
        margin: 0
    },
    pageHeaderText: {
        width: 'fit-content',
        maxWidth: '60%',
        marginLeft: 'auto'
    },
    pageHeaderMeta: {
        width: '100%',
        textAlign: 'right',
        color: CssVar.uiText,
        opacity: 0.78,
        fontSize: '0.95rem',
        lineHeight: 1.6,
        margin: 0
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
        padding: '8px',
        fontSize: '16px',
        borderRadius: '4px',
        borderColor: CssVar.divider,
        backgroundColor: CssVar.contentBackground,
        color: CssVar.contentText,
        width: '100%',
        boxSizing: 'border-box'
    },
    textarea: {
        padding: '8px',
        fontSize: '16px',
        borderRadius: '4px',
        borderColor: CssVar.divider,
        backgroundColor: CssVar.contentBackground,
        color: CssVar.contentText,
        width: '100%',
        minHeight: 120,
        resize: 'vertical',
        boxSizing: 'border-box'
    },
    select: {
        padding: '8px',
        fontSize: '16px',
        borderRadius: '4px',
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
