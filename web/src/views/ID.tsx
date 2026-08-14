import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text, Modal } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { Passport } from '@concrnt/ui'
import Tilt from 'react-parallax-tilt'
import { View } from '../components/View'
import { Header } from '../components/Header'
import { MdBadge, MdKey, MdPublic } from 'react-icons/md'
import { AliasSetupModalContent } from '../components/AliasSetupModalContent'
import { SubkeyList } from '../components/SubkeyList'
import { RegistrationInfo } from '../components/RegistrationInfo'
import { Drawer } from '../components/Drawer'
import { LoadIdentity, type Document } from '@concrnt/client'
import i18n from '../i18n'

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
    const [aliasModalOpen, setAliasModalOpen] = useState(false)
    const [subkeyCopied, setSubkeyCopied] = useState(false)
    const [downloadedSlots, setDownloadedSlots] = useState<string[]>([])
    const [slotVersion, setSlotVersion] = useState(0)
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

    const storedMnemonic = localStorage.getItem('Mnemonic')
    let masterIdentity = null
    try {
        masterIdentity = storedMnemonic ? LoadIdentity(storedMnemonic) : null
    } catch {
        masterIdentity = null
    }
    // ニーモニックがこのセッションのアカウントのものである場合のみバックアップ可能
    const canBackup = masterIdentity !== null && masterIdentity.CCID === client.ccid

    const backupMasterKey = () => {
        if (!masterIdentity) return
        const text = i18n.t('views.accountSetup.masterkeyFileTemplate', {
            ccid: client.ccid,
            mnemonic: masterIdentity.mnemonic_ja,
            domain: client.server.domain ?? 'N/A'
        })

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `concrnt-masterkey-${client.ccid}.txt`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    // 別アカウントでのログイン/新規登録時に退避された旧マスターキー。バックアップDLで回収できる。
    // 削除はDL済みのスロットに限定する(バックアップ無しで鍵を消させないという全体の方針に合わせる)
    void slotVersion
    const evacuatedSlots = Object.keys(localStorage).filter((key) => key.startsWith('EvacuatedKeys:'))

    const downloadEvacuatedSlot = (slotKey: string) => {
        const raw = localStorage.getItem(slotKey)
        if (!raw) return
        const slotCcid = slotKey.slice('EvacuatedKeys:'.length)
        let text: string | null = null
        try {
            const parsed = JSON.parse(raw)
            if (typeof parsed.mnemonic === 'string' && parsed.mnemonic) {
                const identity = LoadIdentity(parsed.mnemonic)
                text = i18n.t('views.accountSetup.masterkeyFileTemplate', {
                    ccid: slotCcid,
                    mnemonic: identity.mnemonic_ja,
                    domain: 'N/A'
                })
            } else if (typeof parsed.privateKey === 'string' && parsed.privateKey) {
                text = parsed.privateKey
            }
        } catch {
            // パース不能でも生値ごと救出できるようにする
            text = raw
        }
        if (!text) text = raw

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `concrnt-masterkey-${slotCcid}.txt`
        anchor.click()
        URL.revokeObjectURL(url)
        setDownloadedSlots((prev) => (prev.includes(slotKey) ? prev : [...prev, slotKey]))
    }

    const copySubkey = () => {
        let subkey = localStorage.getItem('SubKey')
        if (!subkey) return
        // QRSetup経由のセッションはusePersistentがJSON文字列化して保存している
        if (subkey.startsWith('"')) {
            try {
                subkey = JSON.parse(subkey)
            } catch {
                /* raw文字列のまま使う */
            }
        }
        if (!subkey) return
        navigator.clipboard.writeText(subkey)
        setSubkeyCopied(true)
        setTimeout(() => setSubkeyCopied(false), 2000)
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

                <Button disabled={!canBackup} onClick={backupMasterKey}>
                    {t('backupMasterKey')}
                </Button>
                {!canBackup && <Text variant="caption">{t('backupUnavailable')}</Text>}

                {localStorage.getItem('SubKey') && (
                    <Button onClick={copySubkey}>{subkeyCopied ? t('subkeyCopied') : t('copySubkey')}</Button>
                )}

                {evacuatedSlots.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
                        <Text variant="h3">{t('evacuated.title')}</Text>
                        <Text variant="caption">{t('evacuated.description')}</Text>
                        {evacuatedSlots.map((slotKey) => (
                            <div
                                key={slotKey}
                                style={{
                                    border: `1px solid ${CssVar.divider}`,
                                    borderRadius: '8px',
                                    padding: CssVar.space(2),
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: CssVar.space(1)
                                }}
                            >
                                <Text
                                    variant="caption"
                                    style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {slotKey.slice('EvacuatedKeys:'.length)}
                                </Text>
                                <div style={{ display: 'flex', gap: CssVar.space(1) }}>
                                    <Button
                                        onClick={() => {
                                            downloadEvacuatedSlot(slotKey)
                                        }}
                                    >
                                        {t('evacuated.download')}
                                    </Button>
                                    <Button
                                        disabled={!downloadedSlots.includes(slotKey)}
                                        onClick={() => {
                                            localStorage.removeItem(slotKey)
                                            setSlotVersion((v) => v + 1)
                                        }}
                                    >
                                        {t('evacuated.delete')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
