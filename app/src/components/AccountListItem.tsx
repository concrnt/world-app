import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Api, Document, InMemoryAuthProvider, InMemoryKVS } from '@concrnt/client'
import { ProfileSchema, semantics } from '@concrnt/worldlib'
import { Avatar, CssVar, IconButton, ListItem, Text } from '@concrnt/ui'
import { MdCheck, MdDeleteOutline } from 'react-icons/md'
import { AccountSummary } from '../lib/accounts'

interface Props {
    account: AccountSummary
    onClick?: () => void
    onDelete?: () => void
}

// 非アクティブアカウントのプロフィールは認証なしでそのアカウントのドメインから取得する
export const AccountListItem = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.accountListItem' })
    const { account } = props
    const [profile, setProfile] = useState<Document<ProfileSchema> | null>(null)

    const setupIncomplete = !account.domain || !account.ckid

    useEffect(() => {
        if (!account.domain) return
        const api = new Api(account.domain, new InMemoryAuthProvider(), new InMemoryKVS())
        api.getDocument<ProfileSchema>(semantics.profile(account.ccid, 'main'))
            .then((doc) => setProfile(doc ?? null))
            .catch(() => setProfile(null))
    }, [account.ccid, account.domain])

    return (
        <ListItem
            style={{ marginBottom: CssVar.space(1) }}
            icon={<Avatar ccid={account.ccid} src={profile?.value.avatar} style={{ width: '32px', height: '32px' }} />}
            endIcon={account.isActive ? <MdCheck size={20} /> : undefined}
            onClick={props.onClick}
            secondaryAction={
                props.onDelete ? (
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            props.onDelete?.()
                        }}
                    >
                        <MdDeleteOutline size={20} color="#ff7676" />
                    </IconButton>
                ) : undefined
            }
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    paddingLeft: CssVar.space(2),
                    minWidth: 0
                }}
            >
                <Text
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {profile?.value.username ?? `${account.ccid.slice(0, 12)}...`}
                </Text>
                <Text
                    variant="caption"
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {setupIncomplete ? t('setupIncomplete') : account.domain}
                </Text>
            </div>
        </ListItem>
    )
}
