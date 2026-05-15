import { fetchWithTimeout } from '@concrnt/client'
import { useEffect, useState } from 'react'

import { Button, CssVar, Text } from '@concrnt/ui'

import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { TextWidget } from './TextWidget'
import { WidgetProps } from '@rjsf/utils'
import { TextareaWidget } from './TextAreaWidget'
import { SelectWidget } from './SelectWidget'
import { CheckboxWidget } from './CheckboxWidget'
import { MediaInputWidget } from './MediaInputWidget'
import { UserPickerWidget } from './UserPickerWidget'

interface Props {
    schemaURL?: string
    schema?: any
    value: any
    setValue: (_: any) => void
    showSubmit?: boolean
    disabled?: boolean
}

export interface CCEditorError {
    message: string
}

const uiSchema = {
    'ui:submitButtonOptions': {
        norender: true
    }
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
    CheckboxWidget,
    mediaInput: MediaInputWidget,
    userPicker: UserPickerWidget
}

export const CCEditor = (props: Props) => {
    const [schema, setSchema] = useState<any>(props.schema)
    const [errors, setErrors] = useState<CCEditorError[] | undefined>(undefined)

    useEffect(() => {
        if (props.schema || !props.schemaURL) return
        fetchWithTimeout(props.schemaURL, { method: 'GET' })
            .then((e) => e.json())
            .then((e) => {
                setSchema(e)
                // if not compatible, reset form data
                if (props.value) {
                    const errors = validator.rawValidation(schema, props.value)
                    if (errors.errors && errors.errors.length > 0) {
                        props.setValue({})
                    }
                }
            })
            .catch(() => {
                setSchema(undefined)
            })
    }, [props.schemaURL])

    return (
        <div>
            {schema && (
                <>
                    {errors && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(1),
                                marginTop: CssVar.space(1)
                            }}
                        >
                            {errors.map((e, i) => (
                                <div key={i}>
                                    <Text>Validation Error</Text>
                                    {e.message}
                                </div>
                            ))}
                        </div>
                    )}

                    <Form
                        disabled={props.disabled}
                        schema={schema}
                        validator={validator}
                        formData={props.value}
                        uiSchema={{
                            ...uiSchema,
                            ...schema.ui
                        }}
                        widgets={widgets}
                        onChange={(e) => {
                            const errors = validator.rawValidation(schema, e.formData).errors
                            setErrors(errors)
                            props.setValue(e.formData)
                        }}
                        className="cc-editor-form"
                    >
                        <Button
                            //type="submit"
                            variant="contained"
                            disabled={errors && errors.length > 0}
                            style={{
                                display: props.showSubmit ? 'block' : 'none'
                            }}
                        >
                            Submit
                        </Button>
                    </Form>
                    <style>{`
                        .cc-editor-form fieldset {
                            border: none;
                            padding: 0;
                            margin: 0;
                            min-width: 0;
                            display: flex;
                            flex-direction: column;
                            gap: ${CssVar.space(4)};
                        }
                    `}</style>
                </>
            )}
        </div>
    )
}
