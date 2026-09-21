import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Codeblock, Text } from '@concrnt/ui'
import { NotFoundError, parseCCURI, type Document, type SignedDocument } from '@concrnt/client'
import { Schemas, semantics } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { useStack } from '../layouts/Stack'
import { TimelineView } from '../views/Timeline'
import { ProfileView } from '../views/Profile'
import { PostView } from '../views/Post'
import { ListView } from '../views/List'

interface Props {
    uri: string
}

// インベントリのパスバー直下: ちょうどそのキーにあるドキュメントの詳細。
// 既知のschemaには開くためのボタンをswitchのcase追加で足していく
export const InventoryDetail = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.inventory' })
    const { client } = useClient()
    const stack = useStack()
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
                <Button key="timeline" variant="outlined" onClick={() => stack.push(<TimelineView uri={props.uri} />)}>
                    {t('openTimeline')}
                </Button>
            )
            break
        case Schemas.profile: {
            const profileName = semantics.profileNameFromURI(parsed.owner, props.uri)
            actions.push(
                <Button
                    key="profile"
                    variant="outlined"
                    onClick={() =>
                        stack.push(
                            <ProfileView
                                ccid={parsed.owner}
                                profileName={profileName && profileName !== 'main' ? profileName : undefined}
                            />
                        )
                    }
                >
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
                <Button key="post" variant="outlined" onClick={() => stack.push(<PostView uri={props.uri} />)}>
                    {t('openPost')}
                </Button>
            )
            break
        case Schemas.list:
            actions.push(
                <Button key="list" variant="outlined" onClick={() => stack.push(<ListView uri={props.uri} />)}>
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
