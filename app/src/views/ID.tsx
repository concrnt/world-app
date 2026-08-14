import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Button, Text, Modal } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { Passport } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { MdArrowForward, MdBadge, MdKey, MdPublic, MdQrCodeScanner } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { QRSetup } from './QRSetup'
import { BackupKeyButton } from '../components/BackupKeyButton'
import { AliasSetupModalContent } from '../components/AliasSetupModalContent'
import { SubkeyList } from '../components/SubkeyList'
import { RegistrationInfo } from '../components/RegistrationInfo'
import { Drawer } from '../ui/Drawer'
import type { Document } from '@concrnt/client'

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
    const stack = useStack()
    const [aliasModalOpen, setAliasModalOpen] = useState(false)
    const [subkeyDrawerOpen, setSubkeyDrawerOpen] = useState(false)
    const [registrationDrawerOpen, setRegistrationDrawerOpen] = useState(false)
    const [subkeyCount, setSubkeyCount] = useState<number | null>(null)

    // ドロワー内でのrevokeで数が変わりうるので、閉じたタイミングでも取り直す
    useEffect(() => {
        if (!client || subkeyDrawerOpen) return
        client.api
            .queryAll({ prefix: `cckv://${client.ccid}/keys/` })
            .then((results) => {
                let count = 0
                for (const sd of results) {
                    try {
                        const doc: Document<any> = JSON.parse(sd.document)
                        if (doc.schema === 'https://schema.concrnt.net/subkey.json') count++
                    } catch (err) {
                        console.error('failed to parse subkey document', err)
                    }
                }
                setSubkeyCount(count)
            })
            .catch((err) => {
                console.error('failed to count subkeys', err)
            })
    }, [client, subkeyDrawerOpen])

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
                    <InfoTile
                        icon={<MdBadge size={24} />}
                        label={t('alias')}
                        value={alias}
                        onClick={() => {
                            setAliasModalOpen(true)
                        }}
                    />
                    <InfoTile
                        icon={<MdPublic size={24} />}
                        label={t('homeServer.title')}
                        value={client.server.domain ?? 'Unknown'}
                        onClick={() => {
                            setRegistrationDrawerOpen(true)
                        }}
                    />
                </div>

                <InfoTile
                    icon={<MdKey size={24} />}
                    label={t('subkeys.title')}
                    value={subkeyCount !== null ? t('subkeys.count', { count: subkeyCount }) : '…'}
                    onClick={() => {
                        setSubkeyDrawerOpen(true)
                    }}
                />

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
            <Modal open={aliasModalOpen} onClose={() => setAliasModalOpen(false)}>
                <AliasSetupModalContent onClose={() => setAliasModalOpen(false)} />
            </Modal>
            <Drawer open={subkeyDrawerOpen} onClose={() => setSubkeyDrawerOpen(false)}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: CssVar.space(4) }}>
                        <SubkeyList />
                    </div>
                </div>
            </Drawer>
            <Drawer open={registrationDrawerOpen} onClose={() => setRegistrationDrawerOpen(false)}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: CssVar.space(4) }}>
                        <RegistrationInfo />
                    </div>
                </div>
            </Drawer>
        </View>
    )
}
