import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button, Codeblock, Text } from '@concrnt/ui'
import { NotFoundError, parseCCURI, type Document, type SignedDocument } from '@concrnt/client'
import { Schemas, semantics } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'

interface Props {
    uri: string
}

// インベントリのパスバー直下: ちょうどそのキーにあるドキュメントの詳細。
// 既知のschemaには開くためのボタンをswitchのcase追加で足していく
export const InventoryDetail = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.inventory' })
    const { client } = useClient()
    const navigate = useNavigate()
    const parsed = parseCCURI(props.uri)

    const [signedDocument, setSignedDocument] = useState<SignedDocument | null>(null)
    const [notFound, setNotFound] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        // 404はネガティブキャッシュされるため、中間キー→ドキュメント化した直後でも実体を見に行く
        client.api
            .getResource<SignedDocument>(props.uri, undefined, { cache: 'no-cache' })
            .then((sd) => {
                if (!cancelled) setSignedDocument(sd)
            })
            .catch((e) => {
                if (cancelled) return
                if (e instanceof NotFoundError) setNotFound(true)
                else setError(String(e))
            })
        return () => {
            cancelled = true
        }
    }, [client, props.uri])

    if (error) {
        return <Text style={{ color: 'red' }}>{t('loadFailed', { error })}</Text>
    }
    if (notFound) {
        return <Text variant="caption">{t('noDocument')}</Text>
    }
    if (!signedDocument) {
        return <Text variant="caption">Loading...</Text>
    }

    let document: Document<any> | null = null
    try {
        document = JSON.parse(signedDocument.document)
    } catch {
        document = null
    }

    const actions: React.ReactNode[] = []
    switch (document?.schema) {
        case Schemas.userTimeline:
        case Schemas.communityTimeline:
        case Schemas.subprofileTimeline:
        case Schemas.apInboxTimeline:
            actions.push(
                <Button
                    key="timeline"
                    variant="outlined"
                    onClick={() => navigate('/timeline/' + encodeURIComponent(props.uri))}
                >
                    {t('openTimeline')}
                </Button>
            )
            break
        case Schemas.profile: {
            const profileName = semantics.profileNameFromURI(parsed.owner, props.uri)
            const path = '/profile/' + parsed.owner + (profileName && profileName !== 'main' ? '/' + profileName : '')
            actions.push(
                <Button key="profile" variant="outlined" onClick={() => navigate(path)}>
                    {t('openProfile')}
                </Button>
            )
            break
        }
        case Schemas.markdownMessage:
        case Schemas.replyMessage:
        case Schemas.rerouteMessage:
        case Schemas.plaintextMessage:
        case Schemas.mediaMessage:
        case Schemas.gfmMessage:
        case Schemas.mfmMessage:
            actions.push(
                <Button
                    key="post"
                    variant="outlined"
                    onClick={() => navigate('/post/' + encodeURIComponent(props.uri))}
                >
                    {t('openPost')}
                </Button>
            )
            break
        case Schemas.list:
            actions.push(
                <Button
                    key="list"
                    variant="outlined"
                    onClick={() => navigate('/lists/' + encodeURIComponent(props.uri))}
                >
                    {t('openList')}
                </Button>
            )
            break
        default:
            break
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            {document && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text variant="caption" style={{ wordBreak: 'break-all' }}>
                        {t('schema')}: {document.schema}
                    </Text>
                    <Text variant="caption">
                        {t('kind')}: {document.kind}
                    </Text>
                    <Text variant="caption" style={{ wordBreak: 'break-all' }}>
                        {t('author')}: {document.author}
                    </Text>
                    <Text variant="caption">
                        {t('createdAt')}: {new Date(document.createdAt).toLocaleString()}
                    </Text>
                </div>
            )}
            {actions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: CssVar.space(2) }}>{actions}</div>
            )}
            <div>
                <Text variant="h5">{t('document')}</Text>
                <Codeblock language="json">
                    {JSON.stringify({ ...signedDocument, document: document ?? signedDocument.document }, null, 2)}
                </Codeblock>
            </div>
        </div>
    )
}
