import { Codeblock, Text } from '@concrnt/ui'
import { SignedDocument, ValidateSignature } from '@concrnt/client'
import { type Message } from '@concrnt/worldlib'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../../contexts/Client'

interface Props {
    message: Message<any>
}

export const MessageInspector = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.messageInspector' })
    const { client } = useClient()
    const [signedDocument, setSignedDocument] = useState<SignedDocument | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setSignedDocument(null)
        setError(null)
        client.api
            .getResource<SignedDocument>(props.message.uri, props.message.hint)
            .then((sd) => {
                if (!cancelled) setSignedDocument(sd)
            })
            .catch((e) => {
                if (!cancelled) setError(String(e))
            })
        return () => {
            cancelled = true
        }
    }, [client, props.message.uri, props.message.hint])

    const signatureInfo = useMemo(() => {
        if (!signedDocument) return null
        // subkey署名は proof.key が cckv://<CCID>/keys/<CKID> のURI。末尾のCKIDで検証する。
        // master署名は proof.key が無いので投稿者のCCIDで検証する。
        const isSubkey = !!signedDocument.proof.key
        const expectedKeyID = isSubkey ? (signedDocument.proof.key?.split('/').pop() ?? '') : props.message.author
        try {
            const valid = ValidateSignature(signedDocument.document, signedDocument.proof.signature, expectedKeyID)
            return { valid, expectedKeyID, isSubkey, error: null as string | null }
        } catch (e) {
            return { valid: false, expectedKeyID, isSubkey, error: String(e) }
        }
    }, [signedDocument, props.message.author])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                height: '100%',
                overflowY: 'auto',
                padding: '4px'
            }}
        >
            <Text variant="h1">{t('title')}</Text>
            <Text variant="caption" style={{ wordBreak: 'break-all' }}>
                {props.message.uri}
            </Text>

            {error && <Text style={{ color: 'red' }}>{t('loadFailed', { error })}</Text>}
            {!signedDocument && !error && <Text>Loading...</Text>}

            {signedDocument && signatureInfo && (
                <>
                    {/* 署名検証 */}
                    <div>
                        <Text variant="h5">{t('signatureVerification')}</Text>
                        {signatureInfo.valid ? (
                            <Text style={{ color: 'green' }}>✓ Signature valid</Text>
                        ) : (
                            <Text style={{ color: 'red' }}>✗ Signature invalid</Text>
                        )}
                        <Text variant="caption" style={{ wordBreak: 'break-all' }}>
                            type: {signedDocument.proof.type}
                        </Text>
                        <Text variant="caption" style={{ wordBreak: 'break-all' }}>
                            {t('verificationKey', { type: signatureInfo.isSubkey ? 'subkey' : 'master' })}:{' '}
                            {signatureInfo.expectedKeyID}
                        </Text>
                        {signatureInfo.error && (
                            <Text variant="caption" style={{ color: 'red', wordBreak: 'break-all' }}>
                                {t('verificationError', { error: signatureInfo.error })}
                            </Text>
                        )}
                        {!signatureInfo.valid && !signatureInfo.error && (
                            <Text variant="caption" style={{ color: 'red' }}>
                                {t('keyMismatch')}
                            </Text>
                        )}
                    </div>

                    {/* Document */}
                    <div>
                        <Text variant="h5">Document</Text>
                        <Codeblock language="json">
                            {JSON.stringify(
                                { ...signedDocument, document: JSON.parse(signedDocument.document) },
                                null,
                                2
                            )}
                        </Codeblock>
                    </div>

                    {/* Associations */}
                    <div>
                        <Text variant="h5">Associations</Text>
                        <Codeblock language="json">{JSON.stringify(props.message.associations, null, 2)}</Codeblock>
                    </div>
                </>
            )}
        </div>
    )
}
