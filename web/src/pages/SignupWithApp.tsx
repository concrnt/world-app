// セルフホストされた web の「このサーバーに登録する」。鍵はこのブラウザでは作らず、
// 同意 → QR → アプリがマスターキーを作って entity 文書に署名 → ここで登録 POST → そのまま
// QRSetup の通常のログイン手順(このブラウザ用サブキーをアプリが enact)に合流してログイン済みで / へ進む。
// アプリに既にアカウントがあればアプリ側の確認を経て既存アカウントでのログインになる
import type { CSSProperties } from 'react'
import type { FieldProps, RJSFSchema, StrictRJSFSchema, UiSchema, WidgetProps } from '@rjsf/utils'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { Suspense, use, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import Tilt from 'react-parallax-tilt'
import { QRCode } from 'react-qrcode-logo'
import { MdPhoneIphone } from 'react-icons/md'
import { Api, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { CssVar, HorizontalLayout, Passport, Text, TextField } from '@concrnt/ui'
import { emojihash, type SignalRegisterInitResponse } from '@concrnt/worldlib'
import { QRSetup } from '../components/QRSetup'
import { ExternalLink } from '../components/ExternalLink'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from '../views/authLayout'
import appStoreBadge from '../assets/appstore-badge.svg'
import googlePlayBadge from '../assets/googleplay-badge.png'
import css from './SignupWithApp.module.css'

export const isConcrntWorld = () =>
    window.location.hostname === 'concrnt.world' || window.location.hostname === 'localhost'

export const SignupWithApp = () => {
    // .well-known/concrnt や /tos を相対パスで取るので、サーバー自身にホストされた web でしか成り立たない
    if (isConcrntWorld()) return <Navigate to="/signup/browser" replace />
    return <Loader />
}

const Loader = () => {
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

const Inner = (props: {
    serverPromise: Promise<any>
    tosPromise: Promise<string>
    codeOfConductPromise: Promise<string>
    schemaPromise: Promise<RJSFSchema>
}) => {
    const { t } = useTranslation('', { keyPrefix: 'web.signupWithApp' })
    const { t: tRegister } = useTranslation('', { keyPrefix: 'web.register' })
    const navigate = useNavigate()
    const server = use(props.serverPromise)
    const domain: string = server.domain
    const tos = use(props.tosPromise)
    const codeOfConduct = use(props.codeOfConductPromise)
    const schema = use(props.schemaPromise)

    const [step, setStep] = useState<'consent' | 'qr'>('consent')
    // scan: QR とストア案内 / received: アプリから entity 文書が届き、登録ボタン待ち / login: 登録済み(または既存アカウント)で QRSetup のログイン UI
    const [phase, setPhase] = useState<'scan' | 'received' | 'login'>('scan')
    const [loginFallback, setLoginFallback] = useState(false)
    const [formData, setFormData] = useState<any>({})
    const [inviteCode, setInviteCode] = useState<string>(window.location.hash.replace('#', '') || '')
    const [captcha, setCaptcha] = useState('')
    const [received, setReceived] = useState<{ ccid: string; entity: SignalRegisterInitResponse['entity'] } | null>(
        null
    )
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const formShellRef = useRef<HTMLDivElement | null>(null)
    const recaptchaRef = useRef<ReCAPTCHA | null>(null)
    // onRegister の Promise は登録 POST が成功したときだけ解決する(失敗はこの画面で再試行)
    const resolveRef = useRef<(() => void) | null>(null)

    const uiSchema = useMemo<UiSchema>(() => {
        return {
            'ui:submitButtonOptions': {
                norender: true
            }
        }
    }, [])

    const onRegister = (ccid: string, entity: SignalRegisterInitResponse['entity']): Promise<void> => {
        setReceived({ ccid, entity })
        setPhase('received')
        return new Promise<void>((resolve) => {
            resolveRef.current = resolve
        })
    }

    const register = async () => {
        if (!received) return

        setError(null)
        setProcessing(true)
        try {
            const authProvider = new InMemoryAuthProvider(undefined, undefined)
            const kvs = new InMemoryKVS()
            const api = new Api(domain, authProvider, kvs)

            const request = {
                document: received.entity.document,
                proof: received.entity.proof,
                meta: formData,
                inviteToken: server.meta.registration === 'invite' ? inviteCode : undefined
            }

            await api.requestConcrntApi(
                domain,
                'net.concrnt.world.register',
                {},
                {
                    method: 'POST',
                    body: JSON.stringify(request),
                    headers: {
                        'Content-Type': 'application/json',
                        captcha: captcha
                    }
                }
            )

            resolveRef.current?.()
            resolveRef.current = null
            setReceived(null)
            setPhase('login')
        } catch (err) {
            console.error('Failed to register', err)
            setError(err instanceof Error ? err.message : String(err))
            // reCAPTCHA のトークンは使い切り/短命なので解き直してもらう
            recaptchaRef.current?.reset()
            setCaptcha('')
        } finally {
            setProcessing(false)
        }
    }

    if (step === 'consent') {
        return (
            <AuthScreen align="top">
                <AuthHeader title={t('title')} description={t('consentDescription', { domain })} />

                <PolicySection title={tRegister('codeOfConduct')} body={codeOfConduct} />
                <PolicySection title={tRegister('tos')} body={tos} />

                <div style={authStyles.section}>
                    <Text variant="h2" style={styles.sectionTitle}>
                        {tRegister('registrationForm')}
                    </Text>
                    <Text style={styles.sectionDescription}>{tRegister('formDescription')}</Text>

                    <div className={css.formShell} ref={formShellRef}>
                        {server.meta.registration === 'invite' && (
                            <>
                                <Text style={{ color: CssVar.uiText }}>{tRegister('inviteCode')}</Text>
                                <TextField value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                            </>
                        )}
                        <Form<RJSFSchema, any, StrictRJSFSchema>
                            schema={schema}
                            uiSchema={uiSchema}
                            validator={validator}
                            onSubmit={(e) => {
                                setFormData(e.formData)
                                setStep('qr')
                            }}
                            formData={formData}
                            onChange={(e) => setFormData(e.formData)}
                            templates={{
                                FieldTemplate: RegisterFieldTemplate
                            }}
                            widgets={widgets}
                        />
                    </div>
                </div>

                <AuthActions fixedBottom>
                    <AuthButton onClick={() => formShellRef.current?.querySelector('form')?.requestSubmit()}>
                        {t('agreeAndContinue')}
                    </AuthButton>
                    <AuthTextButton onClick={() => navigate('/signup/browser')}>
                        {t('registerInBrowser')}
                    </AuthTextButton>
                    <AuthTextButton onClick={() => navigate('/login')}>{t('back')}</AuthTextButton>
                </AuthActions>
            </AuthScreen>
        )
    }

    return (
        <AuthScreen align="top">
            <AuthHeader
                title={loginFallback ? t('loginFallbackTitle') : t('title')}
                description={
                    loginFallback
                        ? t('loginFallbackDescription')
                        : phase === 'received'
                          ? t('receivedDescription', { domain })
                          : t('scanDescription', { domain })
                }
            />

            {phase === 'scan' && !loginFallback && (
                <div
                    style={{
                        width: '100%',
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: CssVar.round(1),
                        padding: CssVar.space(2.5),
                        backgroundColor: `rgb(from ${CssVar.contentBackground} r g b / 0.86)`,
                        boxShadow: `inset 0 1px 0 rgb(from ${CssVar.contentText} r g b / 0.08)`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: CssVar.space(2)
                        }}
                    >
                        <div
                            style={{
                                width: 42,
                                height: 42,
                                borderRadius: CssVar.round(1),
                                backgroundColor: `rgb(from ${CssVar.contentLink} r g b / 0.14)`,
                                color: CssVar.contentLink,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: '0 0 auto'
                            }}
                        >
                            <MdPhoneIphone size={24} />
                        </div>
                        <div
                            style={{
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(1)
                            }}
                        >
                            <Text
                                style={{
                                    color: CssVar.contentText,
                                    fontWeight: 700,
                                    lineHeight: 1.35
                                }}
                            >
                                {t('installTitle')}
                            </Text>
                            <Text
                                style={{
                                    color: CssVar.contentText,
                                    opacity: 0.76,
                                    lineHeight: 1.65,
                                    fontSize: '0.92rem'
                                }}
                            >
                                {t('installDescription')}
                            </Text>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: CssVar.space(3),
                            flexWrap: 'wrap'
                        }}
                    >
                        {[
                            {
                                label: 'Download on the App Store',
                                badge: appStoreBadge,
                                url: 'https://apps.apple.com/jp/app/concrnt-world/id6757524249'
                            },
                            {
                                label: 'Get it on Google Play',
                                badge: googlePlayBadge,
                                url: 'https://play.google.com/store/apps/details?id=world.concrnt.app'
                            }
                        ].map((store) => (
                            <ExternalLink
                                key={store.label}
                                href={store.url}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: CssVar.space(1.5),
                                    textDecoration: 'none'
                                }}
                            >
                                <div
                                    style={{
                                        padding: 8,
                                        borderRadius: CssVar.round(1),
                                        backgroundColor: '#ffffff',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <QRCode
                                        value={store.url}
                                        size={288}
                                        ecLevel="M"
                                        quietZone={0}
                                        style={{ width: 144, height: 144 }}
                                        fgColor="#000000"
                                        bgColor="#ffffff"
                                        qrStyle="squares"
                                        eyeRadius={0}
                                    />
                                </div>
                                <img
                                    src={store.badge}
                                    alt={store.label}
                                    style={{
                                        height: 40,
                                        width: 'auto'
                                    }}
                                />
                            </ExternalLink>
                        ))}
                    </div>
                </div>
            )}

            {phase === 'scan' && !loginFallback && (
                <Text variant="h4" style={{ margin: 0, textAlign: 'center' }}>
                    {t('scanTitle')}
                </Text>
            )}

            <QRSetup
                registration={{
                    domain,
                    onRegister,
                    onLoginFallback: () => {
                        setLoginFallback(true)
                        setPhase('login')
                    }
                }}
            />

            {phase === 'scan' && !loginFallback && (
                <div style={{ ...authStyles.section, gap: CssVar.space(1) }}>
                    <Text variant="caption" style={{ color: CssVar.uiText, opacity: 0.72, textAlign: 'center' }}>
                        {t('appVersionHint')}
                    </Text>
                    <Text variant="caption" style={{ color: CssVar.uiText, opacity: 0.72, textAlign: 'center' }}>
                        {t('reloadHint')}
                    </Text>
                </div>
            )}

            {phase === 'received' && received && (
                <>
                    <div style={authStyles.passportWrap} data-testid="signup-received">
                        <Tilt glareEnable={true} glareBorderRadius="5%">
                            <Passport
                                ccid={received.ccid}
                                name={'...'}
                                avatar={''}
                                host={domain}
                                cdate={new Date().toLocaleDateString()}
                            />
                        </Tilt>
                    </div>
                    <div
                        style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: CssVar.space(2),
                            textAlign: 'center'
                        }}
                    >
                        <Text style={{ fontSize: '2rem', margin: 0 }}>{emojihash(received.ccid)}</Text>
                        <Text style={{ color: CssVar.uiText, margin: 0 }}>{t('confirmEmoji')}</Text>
                    </div>

                    {server.meta.captchaSiteKey && (
                        <div style={authStyles.section}>
                            <Text style={{ color: CssVar.uiText }}>reCAPTCHA</Text>
                            <HorizontalLayout>
                                <ReCAPTCHA
                                    ref={recaptchaRef}
                                    sitekey={server.meta.captchaSiteKey}
                                    onChange={(value) => setCaptcha(value ?? '')}
                                />
                            </HorizontalLayout>
                        </div>
                    )}

                    <AuthActions fixedBottom>
                        {error && (
                            <Text
                                style={{
                                    color: '#ff5b5b',
                                    textAlign: 'center',
                                    wordBreak: 'break-all',
                                    whiteSpace: 'pre-line'
                                }}
                            >
                                {t('registerFailed')}
                                {'\n'}
                                {error}
                            </Text>
                        )}
                        <AuthButton
                            disabled={(!!server.meta.captchaSiteKey && captcha === '') || processing}
                            onClick={() => {
                                void register()
                            }}
                        >
                            {processing ? tRegister('registering') : tRegister('register')}
                        </AuthButton>
                    </AuthActions>
                </>
            )}

            {phase === 'scan' && !loginFallback && (
                <AuthActions fixedBottom>
                    <AuthTextButton onClick={() => setStep('consent')}>{t('back')}</AuthTextButton>
                </AuthActions>
            )}
        </AuthScreen>
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
    const { id, value, required, disabled, readonly, autofocus, placeholder, onChange, onBlur, onFocus, options } =
        props
    const inputType = (options.inputType as string | undefined) ?? 'text'

    return (
        <input
            id={id}
            type={inputType}
            autoFocus={autofocus}
            required={required}
            disabled={disabled || readonly}
            placeholder={placeholder}
            value={typeof value === 'string' ? value : (value ?? '')}
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
            value={typeof value === 'string' ? value : (value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onBlur(id, e.target.value)}
            onFocus={(e) => onFocus(id, e.target.value)}
            style={styles.textarea}
        />
    )
}

const SelectWidget = (props: WidgetProps) => {
    const { t } = useTranslation('', { keyPrefix: 'web.register' })
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
                {placeholder ?? t('selectPlaceholder')}
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
    PasswordWidget: (props: WidgetProps) => (
        <TextWidget {...props} options={{ ...props.options, inputType: 'password' }} />
    ),
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
    sectionDescription: {
        color: CssVar.uiText,
        opacity: 0.78,
        lineHeight: 1.6,
        fontSize: '0.95rem',
        margin: 0,
        textAlign: 'left'
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
