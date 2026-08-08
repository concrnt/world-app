import { fetchWithTimeout, Policy, PolicyEntry } from '@concrnt/client'
import { TextField, Text, IconButton, CssVar, Button, ToggleGroup } from '@concrnt/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CCEditor } from '../CCEditor'
import { IoIosCloseCircle } from 'react-icons/io'

interface Props {
    policy?: Policy
    setPolicy: (policy?: Policy) => void
}

export const PolicyEditor = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.policyEditor' })
    const [mode, setMode] = useState<'ui' | 'json'>('ui')
    const [jsonDraft, setJsonDraft] = useState('')
    const [jsonError, setJsonError] = useState(false)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4)
            }}
        >
            <ToggleGroup
                options={[
                    { value: 'ui', label: t('modeEditor') },
                    { value: 'json', label: t('modeJson') }
                ]}
                value={mode}
                onChange={(value: 'ui' | 'json') => {
                    if (value === 'json') {
                        setJsonDraft(JSON.stringify(props.policy ?? { entries: [] }, null, 2))
                        setJsonError(false)
                    }
                    setMode(value)
                }}
            />
            {mode === 'json' ? (
                <>
                    <textarea
                        value={jsonDraft}
                        rows={12}
                        onChange={(e) => {
                            setJsonDraft(e.target.value)
                            if (e.target.value.trim() === '') {
                                props.setPolicy(undefined)
                                setJsonError(false)
                                return
                            }
                            try {
                                props.setPolicy(JSON.parse(e.target.value))
                                setJsonError(false)
                            } catch {
                                setJsonError(true)
                            }
                        }}
                        style={{
                            padding: '8px',
                            fontSize: '16px',
                            fontFamily: 'Source Code Pro, monospace',
                            borderRadius: CssVar.round(1),
                            border: `1px solid ${CssVar.divider}`,
                            backgroundColor: CssVar.contentBackground,
                            color: CssVar.contentText,
                            width: '100%',
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            boxShadow: 'none',
                            outline: 'none'
                        }}
                    />
                    {jsonError && <Text variant="caption">{t('invalidJson')}</Text>}
                </>
            ) : (
                <>
                    {props.policy?.entries.map((entry, index) => (
                        <>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: CssVar.space(2)
                                }}
                            >
                                <Text variant="h3">Entry {index + 1}</Text>
                                <IconButton
                                    onClick={() => {
                                        const newEntries = [...props.policy!.entries]
                                        newEntries.splice(index, 1)
                                        props.setPolicy({
                                            ...props.policy!,
                                            entries: newEntries
                                        })
                                    }}
                                >
                                    <IoIosCloseCircle />
                                </IconButton>
                            </div>
                            <Entry
                                key={index}
                                entry={entry}
                                updateEntry={(updatedEntry) => {
                                    const newEntries = [...props.policy!.entries]
                                    newEntries[index] = updatedEntry
                                    props.setPolicy({
                                        ...props.policy!,
                                        entries: newEntries
                                    })
                                }}
                            />
                        </>
                    ))}
                    <Button
                        onClick={() => {
                            const newEntry: PolicyEntry = {
                                url: '',
                                params: {}
                            }
                            props.setPolicy({
                                ...props.policy,
                                entries: [...(props.policy?.entries || []), newEntry]
                            } as Policy)
                        }}
                    >
                        Add Policy
                    </Button>
                </>
            )}
        </div>
    )
}

const Entry = (props: { entry: PolicyEntry; updateEntry: (entry: PolicyEntry) => void }) => {
    const [policyJson, setPolicyJson] = useState<any>()
    const schema = policyJson?.paramSchema

    useEffect(() => {
        fetchWithTimeout(props.entry.url, { method: 'GET' })
            .then((e) => e.json())
            .then((e) => {
                if (e.versions) {
                    if (e.versions['2025-12-23']) {
                        setPolicyJson(e.versions['2025-12-23'])
                    }
                }
            })
    }, [props.entry])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(4)
            }}
        >
            <TextField
                value={props.entry.url}
                onChange={(e) => props.updateEntry({ ...props.entry, url: e.target.value })}
            />
            {schema && (
                <CCEditor
                    schema={schema}
                    value={props.entry.params}
                    setValue={(params) => props.updateEntry({ ...props.entry, params })}
                />
            )}
        </div>
    )
}
