import { Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseCCURI, Server } from '@concrnt/client'
import { Avatar, Chip, CssVar, Divider, ExternalLink, Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { useResource } from '../hooks/useResource'
import { Drawer } from './Drawer'

interface Props {
    uri: string
}

// リソースをホストしているサーバーを表示するチップ。クリックでサーバー詳細を開く(v1のDomainChip踏襲)
export const ServerChip = (props: Props) => {
    return (
        <Suspense>
            <Inner uri={props.uri} />
        </Suspense>
    )
}

interface Host {
    fqdn: string
    server: Server | null
}

const Inner = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.serverChip' })
    const { client } = useClient()
    const [open, setOpen] = useState(false)
    const [coc, setCoc] = useState<string>()

    const host = useResource<Host | null>(`resource-host:${props.uri}`, async () => {
        try {
            const parsed = parseCCURI(props.uri)
            const fqdn = await client.api.resolveDomain(parsed.owner, parsed.hint)
            const server = await client.api.getServer(fqdn).catch(() => null)
            return { fqdn, server }
        } catch {
            return null
        }
    })

    useEffect(() => {
        if (!open || !host || coc !== undefined) return
        fetch(`https://${host.fqdn}/code-of-conduct`)
            .then((res) => (res.ok ? res.text() : ''))
            .then((text) => setCoc(text))
            .catch(() => setCoc(''))
    }, [open, host, coc])

    if (!host) return null

    const meta = host.server?.meta
    const nickname = typeof meta?.nickname === 'string' && meta.nickname ? meta.nickname : undefined
    const logo = typeof meta?.logo === 'string' && meta.logo ? meta.logo : undefined
    const description = typeof meta?.description === 'string' && meta.description ? meta.description : undefined

    return (
        <>
            <Chip
                variant="outlined"
                onClick={() => setOpen(true)}
                headElement={
                    <Avatar
                        ccid={host.fqdn}
                        src={logo}
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%'
                        }}
                    />
                }
                style={{
                    maxWidth: '100%'
                }}
            >
                <span
                    style={{
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {nickname ?? host.fqdn}
                </span>
            </Chip>
            <Drawer open={open} onClose={() => setOpen(false)}>
                <div
                    style={{
                        padding: CssVar.space(2),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: CssVar.space(2)
                        }}
                    >
                        <Avatar
                            ccid={host.fqdn}
                            src={logo}
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%'
                            }}
                        />
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0
                            }}
                        >
                            <Text variant="h2">{nickname ?? host.fqdn}</Text>
                            <Text variant="caption">{host.fqdn}</Text>
                        </div>
                    </div>
                    {description && <Text>{description}</Text>}
                    <Divider />
                    <Text variant="h3">{t('codeOfConduct')}</Text>
                    {coc ? (
                        <div
                            style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}
                        >
                            <Text>{coc}</Text>
                        </div>
                    ) : (
                        <Text>{t('cocNotAvailable')}</Text>
                    )}
                    <Divider />
                    <ExternalLink href={`https://${host.fqdn}/tos`}>{t('termsOfService')}</ExternalLink>
                </div>
            </Drawer>
        </>
    )
}
