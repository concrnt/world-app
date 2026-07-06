import { useClient } from '../contexts/Client'
import { useSelect } from '../contexts/Select'
import { Avatar, CssVar, IconButton, ListItem, Text } from '@concrnt/ui'
import { ReactNode, useCallback, useMemo } from 'react'
import { useDrawer } from '../contexts/Drawer'
import { useModal } from '../contexts/Modal'
import { ProfileEditor } from './ProfileEditor'
import { semantics } from '@concrnt/worldlib'
import { HiSwitchHorizontal } from 'react-icons/hi'
import { MdManageAccounts, MdPersonAdd } from 'react-icons/md'
import { ProfileName } from './ProfileName'
import { AccountListItem } from './AccountListItem'
import { AddAccountDrawer } from './AddAccountDrawer'
import { ResetSessionModalContent } from './ResetSessionButton'
import { listAccounts, performAccountSwitch } from '../lib/accounts'

export const SwitchAccountButton = (): ReactNode => {
    const { client, reload } = useClient()
    const { select, close } = useSelect()
    const drawer = useDrawer()
    const modal = useModal()

    // 2段目のシート: 端末に保存されているアカウント(鍵)の一覧
    const openAccountSheet = useCallback(async () => {
        if (!client) return
        const accounts = await listAccounts().catch(() => [])

        const options: ReactNode[] = accounts.map((account) => (
            <AccountListItem
                key={account.ccid}
                account={account}
                onClick={() => {
                    if (account.isActive) {
                        close()
                        return
                    }
                    performAccountSwitch(account.ccid)
                }}
                onDelete={() => {
                    close()
                    modal.open(
                        <ResetSessionModalContent
                            ccid={account.ccid}
                            onDone={() => {
                                modal.close()
                                // アクティブアカウントを消した場合はRust側が次のアカウントへ
                                // 付け替えるので、いずれにせよリロードして整合させる
                                window.location.reload()
                            }}
                            onCancel={() => {
                                modal.close()
                            }}
                        />
                    )
                }}
            />
        ))

        options.push(
            <ListItem
                key={'$addAccount'}
                icon={<MdPersonAdd size={24} />}
                onClick={() => {
                    close()
                    drawer.open(<AddAccountDrawer previousCcid={client.ccid} onClose={() => drawer.close()} />)
                }}
            >
                <Text>アカウントを追加</Text>
            </ListItem>
        )

        select('アカウント', options)
    }, [client, select, close, drawer, modal])

    const options: ReactNode[] = useMemo(() => {
        const result: ReactNode[] = []
        if (!client) return result

        for (const [key, profile] of Object.entries(client.profiles)) {
            result.push(
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
                        close()
                        drawer.close()
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

        result.push(
            <ListItem
                key={'$add'}
                icon={<MdPersonAdd size={24} />}
                onClick={() => {
                    drawer.open(
                        <ProfileEditor
                            noLoading
                            onComplete={() => {
                                close()
                                drawer.close()
                            }}
                            targetURI={semantics.profile(client.ccid, Date.now().toString())}
                            title="Create New Profile"
                        />
                    )
                }}
            >
                <Text>プロフィールを追加</Text>
            </ListItem>
        )

        result.push(
            <ListItem
                key={'$switchAccount'}
                icon={<MdManageAccounts size={24} />}
                onClick={() => {
                    openAccountSheet()
                }}
            >
                <Text>アカウントを切り替え</Text>
            </ListItem>
        )

        return result
    }, [client, reload, close, drawer, openAccountSheet])

    return (
        <IconButton
            onClick={(e) => {
                e.stopPropagation()
                if (!client) return
                select('Switch Account', options)
            }}
        >
            <HiSwitchHorizontal size={20} color={CssVar.backdropText} />
        </IconButton>
    )
}
