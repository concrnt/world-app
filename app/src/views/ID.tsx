import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Button, Text } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { Passport } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { MdArrowForward, MdBadge, MdPublic, MdQrCodeScanner } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { QRSetup } from './QRSetup'
import { BackupKeyButton } from '../components/BackupKeyButton'

const InfoTile = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => {
    return (
        <div
            style={{
                border: `1px solid ${CssVar.divider}`,
                borderRadius: '8px',
                padding: CssVar.space(2),
                display: 'grid',
                gridTemplateRows: '24px 18px 24px',
                gap: CssVar.space(1),
                minWidth: 0
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
    const stack = useStack()

    if (!client) return null

    const username = client.profile?.username
    const alias = client.entity.alias || t('aliasNotSet')

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
                    overflowY: 'auto',
                    touchAction: 'pan-y'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                    <Text variant="h3">Passport</Text>
                    <Text variant="caption">{t('passportDescription')}</Text>
                </div>

                <div onPointerDownCapture={(e) => e.stopPropagation()}>
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
                    <InfoTile icon={<MdBadge size={24} />} label={t('alias')} value={alias} />
                    <InfoTile
                        icon={<MdPublic size={24} />}
                        label="Home Server"
                        value={client.server.domain ?? 'Unknown'}
                    />
                </div>

                <Button
                    startIcon={<MdQrCodeScanner />}
                    endIcon={<MdArrowForward size={20} />}
                    onClick={() => {
                        stack.push(
                            <QRSetup
                                onComplete={() => {
                                    setTimeout(() => {
                                        stack.pop()
                                    }, 1000)
                                }}
                            />
                        )
                    }}
                >
                    {t('loginOnAnotherDevice')}
                </Button>
                <BackupKeyButton />
            </div>
        </View>
    )
}
