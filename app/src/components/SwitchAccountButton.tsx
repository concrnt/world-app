import { useClient } from '../contexts/Client'
import { Avatar, CssVar, IconButton, ListItem, Modal, Select, Text } from '@concrnt/ui'
import { ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { ProfileEditor } from './ProfileEditor'
import { semantics } from '@concrnt/worldlib'
import { HiSwitchHorizontal } from 'react-icons/hi'
import { MdManageAccounts, MdPersonAdd } from 'react-icons/md'
import { ProfileName } from './ProfileName'
import { AccountListItem } from './AccountListItem'
import { AddAccountDrawer } from './AddAccountDrawer'
import { ResetSessionModalContent } from './ResetSessionButton'
import { AccountSummary, listAccounts, performAccountSwitch } from '../lib/accounts'

export const SwitchAccountButton = (): ReactNode => {
    const { t } = useTranslation('', { keyPrefix: 'components.switchAccountButton' })
    const { client, reload } = useClient()

    const [menuOpen, setMenuOpen] = useState(false)
    // 2段目のシート: 端末に保存されているアカウント(鍵)の一覧
    const [accounts, setAccounts] = useState<AccountSummary[] | null>(null)
    const [resetTarget, setResetTarget] = useState<string | null>(null)
    const [addAccountOpen, setAddAccountOpen] = useState(false)
    // 新規プロフィールのキーは開いた時点で採番して固定する
    const [newProfileURI, setNewProfileURI] = useState<string | null>(null)

    const accountOptions: ReactNode[] = (accounts ?? []).map((account) => (
        <AccountListItem
            key={account.ccid}
            account={account}
            onClick={() => {
                if (account.isActive) {
                    setAccounts(null)
                    return
                }
                performAccountSwitch(account.ccid)
            }}
            onDelete={() => {
                setResetTarget(account.ccid)
            }}
        />
    ))

    accountOptions.push(
        <ListItem
            key={'$addAccount'}
            icon={<MdPersonAdd size={24} />}
            onClick={() => {
                setAddAccountOpen(true)
            }}
        >
            <Text>{t('addAccount')}</Text>
        </ListItem>
    )

    const options: ReactNode[] = []
    if (client) {
        for (const [key, profile] of Object.entries(client.profiles)) {
            options.push(
                <ListItem
                    key={key}
                    style={{ marginBottom: CssVar.space(1) }}
                    icon={
                        <Avatar
                            ccid={profile.author}
                            src={profile.value.avatar}
                            style={{ width: '32px', height: '32px' }}
                        />
                    }
                    onClick={() => {
                        console.log('Switching account to', key)
                        reload(key)
                        setMenuOpen(false)
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: CssVar.space(2)
                        }}
                    >
                        <Text>
                            <ProfileName document={profile} />
                        </Text>
                    </div>
                </ListItem>
            )
        }

        options.push(
            <ListItem
                key={'$add'}
                icon={<MdPersonAdd size={24} />}
                onClick={() => {
                    setNewProfileURI(semantics.profile(client.ccid, Date.now().toString()))
                }}
            >
                <Text>{t('addProfile')}</Text>
            </ListItem>
        )

        options.push(
            <ListItem
                key={'$switchAccount'}
                icon={<MdManageAccounts size={24} />}
                onClick={() => {
                    listAccounts()
                        .catch(() => [])
                        .then((accountList) => {
                            setAccounts(accountList)
                        })
                }}
            >
                <Text>{t('switchAccount')}</Text>
            </ListItem>
        )
    }

    return (
        <>
            <IconButton
                onClick={(e) => {
                    e.stopPropagation()
                    if (!client) return
                    setMenuOpen(true)
                }}
            >
                <HiSwitchHorizontal size={20} color={CssVar.backdropText} />
            </IconButton>
            <Select
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                title={t('switchAccountTitle')}
                options={options}
            />
            <Select
                open={accounts !== null}
                onClose={() => setAccounts(null)}
                title={t('accountsTitle')}
                options={accountOptions}
            />
            <Modal open={resetTarget !== null} onClose={() => setResetTarget(null)}>
                {resetTarget && (
                    <ResetSessionModalContent
                        ccid={resetTarget}
                        onDone={() => {
                            setResetTarget(null)
                            // アクティブアカウントを消した場合はRust側が次のアカウントへ
                            // 付け替えるので、いずれにせよリロードして整合させる
                            window.location.reload()
                        }}
                        onCancel={() => {
                            setResetTarget(null)
                        }}
                    />
                )}
            </Modal>
            <Drawer open={addAccountOpen} onClose={() => setAddAccountOpen(false)}>
                {client && <AddAccountDrawer previousCcid={client.ccid} onClose={() => setAddAccountOpen(false)} />}
            </Drawer>
            <Drawer open={newProfileURI !== null} onClose={() => setNewProfileURI(null)}>
                {newProfileURI && (
                    <ProfileEditor
                        noLoading
                        onComplete={() => {
                            setMenuOpen(false)
                            setNewProfileURI(null)
                        }}
                        targetURI={newProfileURI}
                        title={t('createNewProfile')}
                    />
                )}
            </Drawer>
        </>
    )
}
