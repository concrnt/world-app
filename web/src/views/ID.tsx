import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { Passport } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { MdBadge, MdPublic } from 'react-icons/md'
import { useModal } from '../contexts/Modal'
import { AliasSetupModalContent } from '../components/AliasSetupModalContent'

const InfoTile = ({
    icon,
    label,
    value,
    onClick
}: {
    icon: ReactNode
    label: string
    value: string
    onClick?: () => void
}) => {
    return (
        <div
            onClick={onClick}
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                padding: CssVar.space(2),
                display: 'grid',
                gridTemplateRows: '24px 18px 24px',
                gap: CssVar.space(1),
                minWidth: 0,
                cursor: onClick ? 'pointer' : undefined
            }}
        >
            <div style={{ color: CssVar.contentLink, display: 'flex', alignItems: 'center' }}>{icon}</div>
            <Text variant="caption" style={{ margin: 0, lineHeight: '18px' }}>
                {label}
            </Text>
            <Text
                variant="h5"
                style={{
                    margin: 0,
                    lineHeight: '24px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}
            >
                {value}
            </Text>
        </div>
    )
}

export const IDView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.id' })
    const { client } = useClient()
    const modal = useModal()

    if (!client) return null

    const username = client.profile?.username
    const alias = client.entity.alias || t('aliasNotSet')

    const backupMasterKey = () => {
        const privateKey = localStorage.getItem('PrivateKey')
        const text = t('backupFileContent', {
            ccid: client.ccid,
            privateKey: privateKey ?? t('backupNotSaved'),
            server: client.server.domain ?? 'N/A',
            interpolation: { escapeValue: false }
        })

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `concrnt-web-backup-${client.ccid}.txt`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2),
                    flex: 1,
                    overflowY: 'auto'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                    <Text variant="h3">Passport</Text>
                    <Text variant="caption">{t('passportDescription')}</Text>
                </div>

                <div>
                    <Tilt glareEnable={true} glareBorderRadius="5%">
                        <Passport
                            ccid={client.ccid}
                            name={username ?? 'No Name'}
                            avatar={client.profile?.avatar ?? ''}
                            host={client.server.domain ?? 'Unknown'}
                            cdate={''}
                        />
                    </Tilt>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: CssVar.space(2) }}>
                    <InfoTile
                        icon={<MdBadge size={24} />}
                        label={t('alias')}
                        value={alias}
                        onClick={() => {
                            modal.open(<AliasSetupModalContent onClose={() => modal.close()} />)
                        }}
                    />
                    <InfoTile
                        icon={<MdPublic size={24} />}
                        label="Home Server"
                        value={client.server.domain ?? 'Unknown'}
                    />
                </div>

                <Button onClick={backupMasterKey}>{t('backupMasterKey')}</Button>
            </div>
        </View>
    )
}
