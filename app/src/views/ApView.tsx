import { useEffect, useState } from 'react'
import { useClient } from '../contexts/Client'
import { CssVar, ExternalLink, Text, View } from '@concrnt/ui'
import { ApNote } from './ApNote'
import { ApPerson } from './ApPerson'
import { ApObject, resolveApObject } from '../utils/activitypub'
import { MdOpenInNew } from 'react-icons/md'
import { useTranslation } from 'react-i18next'

interface Props {
    uri: string
}

export const ApView = (props: Props) => {
    const { client } = useClient()
    const { t } = useTranslation('', { keyPrefix: 'components.activitypubNote' })
    // undefined=読み込み中, null=取得失敗(404/接続不可)
    const [ld, setLd] = useState<ApObject | null>()

    useEffect(() => {
        resolveApObject(client, props.uri)
            .then((res) => {
                setLd(res)
            })
            .catch((err) => {
                console.log(err)
                setLd(null)
            })
    }, [props.uri, client])

    if (ld === undefined) {
        return <View></View>
    }

    if (ld === null) {
        return (
            <View>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: CssVar.space(1),
                        padding: CssVar.space(2)
                    }}
                >
                    <Text style={{ opacity: 0.7 }}>{t('unavailable')}</Text>
                    <ExternalLink
                        href={props.uri}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: CssVar.space(1),
                            fontSize: '0.8rem',
                            color: CssVar.contentLink,
                            textDecoration: 'none'
                        }}
                    >
                        <MdOpenInNew size={14} />
                        {t('openRemote')}
                    </ExternalLink>
                </div>
            </View>
        )
    }

    switch (ld.type) {
        case 'Note':
            return <ApNote note={ld} />
        case 'Person':
            return <ApPerson person={ld} />
        default:
            return (
                <View>
                    <p>Unsupported type: {ld.type}</p>
                    <pre>{JSON.stringify(ld, null, 2)}</pre>
                </View>
            )
    }
}
