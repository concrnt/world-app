import { View, Text, List, ListItem, IconButton, Switch } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClient } from '../contexts/Client'
import { NotFoundError } from '@concrnt/client'
import { Schemas, semantics, type TipjarSchema } from '@concrnt/worldlib'
import { MdContentCopy } from 'react-icons/md'
import { FaEthereum } from 'react-icons/fa6'
import { getEthAddress } from '../lib/eth'
import { useHaptics } from '../contexts/Haptics'

// TipRouter連携。有効化すると cckv://<ccid>/tipjar に受け取りETHアドレスを公開し、
// 他のユーザーがこのアカウントの投稿にスーパーリアクション(チップ付き)を送れるようになる。
// アドレスはConcrntと同じmnemonicからRust側で派生する(app/src/lib/eth.ts)。
export const TipjarSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.tipjarSettings' })
    const { client } = useClient()
    const { hapticLight } = useHaptics()

    // undefined=読み込み中
    const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
    const [address, setAddress] = useState<string | undefined>(undefined)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)

    useEffect(() => {
        getEthAddress(client.ccid)
            .then(setAddress)
            .catch((err) => {
                console.error('failed to get eth address:', err)
                setError(t('error'))
            })

        client.api
            .getDocument<TipjarSchema>(semantics.tipjar(client.ccid), undefined, { cache: 'no-cache' })
            .then((doc) => {
                setEnabled(!!doc.value?.tipjars?.ethereum)
            })
            .catch((err) => {
                if (!(err instanceof NotFoundError)) console.error(err)
                setEnabled(false)
            })
        // マウント時に一度だけ取得する
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const toggle = (next: boolean) => {
        if (!address || busy) return
        setBusy(true)
        setError(undefined)
        const op = next
            ? client.api.commit({
                  kind: 'record' as const,
                  key: semantics.tipjar(client.ccid),
                  author: client.ccid,
                  schema: Schemas.tipjar,
                  value: { tipjars: { ethereum: address } },
                  createdAt: new Date()
              })
            : client.api.delete(semantics.tipjar(client.ccid))
        op.then(() => {
            hapticLight()
            setEnabled(next)
        })
            .catch((err) => {
                console.error('failed to update tipjar:', err)
                setError(t('error'))
            })
            .finally(() => {
                setBusy(false)
            })
    }

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4)
                }}
            >
                <Text>{t('description')}</Text>
                <List>
                    <ListItem
                        startIcon={<FaEthereum size={24} />}
                        secondaryAction={
                            <Switch
                                checked={enabled ?? false}
                                disabled={enabled === undefined || !address || busy}
                                onChange={toggle}
                            />
                        }
                    >
                        {t('enable')}
                    </ListItem>
                </List>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(2)
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <Text variant="caption">{t('address')}</Text>
                        <Text
                            style={{
                                fontFamily: 'monospace',
                                wordBreak: 'break-all'
                            }}
                        >
                            {address ?? '...'}
                        </Text>
                    </div>
                    <IconButton
                        disabled={!address}
                        onClick={() => {
                            if (!address) return
                            navigator.clipboard.writeText(address)
                            hapticLight()
                        }}
                    >
                        <MdContentCopy size={20} />
                    </IconButton>
                </div>
                <Text variant="caption">{enabled ? t('enabled') : t('disabled')}</Text>
                {error && (
                    <Text variant="caption" style={{ color: 'red' }}>
                        {error}
                    </Text>
                )}
            </div>
        </View>
    )
}
