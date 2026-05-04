import type { CSSProperties } from 'react'
import type { FieldProps, RJSFSchema, StrictRJSFSchema, UiSchema, WidgetProps } from '@rjsf/utils'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import ReCAPTCHA from 'react-google-recaptcha'
import { CssVar, Text } from '@concrnt/ui'
import { AuthActions, AuthButton, authStyles } from '../AuthLayout'

interface Props {
    schema: RJSFSchema
    siteKey?: string
    formData: Record<string, unknown>
    captcha: string
    processing: boolean
    hasValidRequest: boolean
    onCaptchaChange: (value: string) => void
    onChange: (value: Record<string, unknown>) => void
    onSubmit: (value: Record<string, unknown>) => void
}

export const RegisterPolicySection = (props: { title: string; body: string }) => {
    return (
        <div style={authStyles.section}>
            <Text
                variant="h2"
                style={{
                    color: CssVar.uiText,
                    fontSize: '1.5rem',
                    lineHeight: 1.3,
                    margin: 0,
                    textAlign: 'left'
                }}
            >
                {props.title}
            </Text>
            <div
                style={{
                    width: '100%',
                    maxHeight: 240,
                    overflowY: 'auto',
                    padding: CssVar.space(3),
                    boxSizing: 'border-box',
                    border: `1px solid ${CssVar.divider}`,
                    borderRadius: CssVar.round(2),
                    backgroundColor: CssVar.contentBackground
                }}
            >
                <Text
                    style={{
                        color: CssVar.contentText,
                        lineHeight: 1.7,
                        margin: 0
                    }}
                >
                    {props.body}
                </Text>
            </div>
        </div>
    )
}

export const RegisterFormSection = (props: Props) => {
    const uiSchema: UiSchema = {
        'ui:submitButtonOptions': {
            norender: true
        }
    }

    return (
        <div style={authStyles.section}>
            <Text
                variant="h2"
                style={{
                    color: CssVar.uiText,
                    fontSize: '1.5rem',
                    lineHeight: 1.3,
                    margin: 0,
                    textAlign: 'left'
                }}
            >
                登録フォーム
            </Text>
            <Text
                style={{
                    color: CssVar.uiText,
                    opacity: 0.78,
                    lineHeight: 1.6,
                    fontSize: '0.95rem',
                    margin: 0,
                    textAlign: 'left'
                }}
            >
                ここで入力する内容は公開プロフィールではありません。サーバーの管理者が登録審査や連絡のために確認する情報です。
            </Text>

            <RegisterPageStyle />

            <div className="register-form-shell">
                <Form<RJSFSchema, Record<string, unknown>, StrictRJSFSchema>
                    schema={props.schema}
                    uiSchema={uiSchema}
                    validator={validator}
                    onSubmit={(event) => {
                        props.onSubmit(event.formData)
                    }}
                    formData={props.formData}
                    onChange={(event) => props.onChange(event.formData)}
                    templates={{
                        FieldTemplate: RegisterFieldTemplate
                    }}
                    widgets={widgets}
                >
                    {props.siteKey && (
                        <div style={authStyles.section}>
                            <Text style={{ color: CssVar.uiText }}>reCAPTCHA</Text>
                            <div
                                style={{
                                    overflowX: 'auto'
                                }}
                            >
                                <ReCAPTCHA sitekey={props.siteKey} onChange={(value) => props.onCaptchaChange(value ?? '')} />
                            </div>
                        </div>
                    )}

                    <AuthActions>
                        <AuthButton
                            disabled={!props.hasValidRequest || (!!props.siteKey && props.captcha === '') || props.processing}
                            onClick={() => {
                                ;(document.querySelector('.register-form-shell form') as HTMLFormElement | null)?.requestSubmit()
                            }}
                        >
                            {props.processing ? '登録中...' : '登録する'}
                        </AuthButton>
                    </AuthActions>
                </Form>
            </div>
        </div>
    )
}

export const RegisterSuccess = () => {
    return (
        <div
            style={{
                width: '100%',
                minHeight: '50dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: CssVar.space(2)
            }}
        >
            <Text
                variant="h2"
                style={{
                    color: CssVar.uiText,
                    margin: 0,
                    fontSize: '1.8rem',
                    lineHeight: 1.3
                }}
            >
                登録完了
            </Text>
            <Text
                style={{
                    color: CssVar.uiText,
                    opacity: 0.78,
                    margin: 0,
                    lineHeight: 1.7
                }}
            >
                この画面を閉じて、元のアプリに戻ることができます。
            </Text>
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

const inputStyle: CSSProperties = {
    padding: CssVar.space(2),
    fontSize: '16px',
    borderRadius: CssVar.round(1),
    borderColor: CssVar.divider,
    backgroundColor: CssVar.contentBackground,
    color: CssVar.contentText,
    width: '100%',
    boxSizing: 'border-box'
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
            style={inputStyle}
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
            style={{
                ...inputStyle,
                minHeight: 120,
                resize: 'vertical'
            }}
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
            style={inputStyle}
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
        <label
            htmlFor={id}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(2)
            }}
        >
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
