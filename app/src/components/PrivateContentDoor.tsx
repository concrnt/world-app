import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '@concrnt/ui'
import { MdLock } from 'react-icons/md'
import { Association, ReadAccessRequestAssociationSchema } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'

interface Props {
    kind: 'profile' | 'timeline'
    targetUri: string
    owner: string
    notifyProfile?: string
}

export const PrivateContentDoor = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.privateContentDoor' })
    const { client } = useClient()

    const [request, setRequest] = useState<Association<ReadAccessRequestAssociationSchema> | null>(null)
    const [loading, setLoading] = useState(true)
    const [working, setWorking] = useState(false)

    useEffect(() => {
        setLoading(true)
        client
            .getOwnReadAccessRequest(props.targetUri)
            .then(setRequest)
            .finally(() => {
                setLoading(false)
            })
    }, [client, props.targetUri])

    const isMe = client.ccid === props.owner

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: CssVar.space(2),
                padding: CssVar.space(4)
            }}
        >
            <MdLock size={96} style={{ opacity: 0.5 }} />
            <Text variant="h3">{props.kind === 'profile' ? t('privateProfile') : t('privateTimeline')}</Text>
            <Text style={{ opacity: 0.7 }}>{t('approvalRequired')}</Text>
            {!isMe && !loading && (
                <Button
                    variant={request ? 'outlined' : 'contained'}
                    disabled={working}
                    onClick={async () => {
                        setWorking(true)
                        try {
                            if (request) {
                                await request.delete(client)
                                setRequest(null)
                            } else {
                                const newRequest = await client.requestReadAccess(
                                    props.targetUri,
                                    props.owner,
                                    props.notifyProfile ?? 'main'
                                )
                                setRequest(newRequest)
                            }
                        } finally {
                            setWorking(false)
                        }
                    }}
                >
                    {request ? t('requested') : t('requestAccess')}
                </Button>
            )}
        </div>
    )
}
