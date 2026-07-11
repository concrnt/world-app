import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { Button, CssVar, Text } from '@concrnt/ui'
import { Client, semantics } from '@concrnt/worldlib'

interface Props {
    client: Client
    onRecovered: () => Promise<void>
    onLogout: () => Promise<void>
}

// サーバーリセットや他デバイスからのrevokeでこの端末のsubkeyが失効した際に表示する、
// 閉じることのできない案内。アプリはマスターキーを保持しているため、その場で再有効化できる。
export const SubkeyInvalidDrawer = ({ client, onRecovered, onLogout }: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.subkeyInvalidDrawer' })
    const [error, setError] = useState('')
    const canSignMaster = client.api.authProvider.canSignMaster()
    const width = Math.min(typeof window !== 'undefined' ? window.innerWidth : 420, 420)

    const reactivate = async () => {
        setError('')
        try {
            const ccid = client.ccid
            const ckid = client.api.authProvider.getCKID()
            if (!ckid) throw new Error(t('ckidNotFound'))

            await client.api.commit(
                {
                    kind: 'record',
                    key: semantics.subkey(ccid, ckid),
                    author: ccid,
                    schema: 'https://schema.concrnt.net/subkey.json',
                    value: { ckid },
                    createdAt: new Date()
                },
                client.server.domain,
                { useMasterkey: true }
            )
            await onRecovered()
        } catch (err) {
            console.error('Failed to reactivate subkey', err)
            const detail = err instanceof Error ? err.message : String(err)
            setError(`${t('reactivateFailed')}\n${detail}`)
        }
    }

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10001,
                display: 'flex'
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'black',
                    opacity: 0.5
                }}
            />
            <motion.div
                initial={{ x: width }}
                animate={{ x: 0 }}
                transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width,
                    maxWidth: '100vw',
                    paddingRight: 'env(safe-area-inset-right)',
                    borderRadius: `${CssVar.round(1)} 0 0 ${CssVar.round(1)}`,
                    backgroundColor: CssVar.contentBackground,
                    color: CssVar.contentText,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4),
                    overflowY: 'auto'
                }}
            >
                <Text variant="h3">{t('titleDevice')}</Text>
                <Text style={{ opacity: 0.8 }}>{t('revokedDevice')}</Text>
                <Text style={{ opacity: 0.8 }}>
                    {canSignMaster ? t('reactivateHintDevice') : t('reloginHintDevice')}
                </Text>
                {error && (
                    <Text style={{ color: '#ff7676', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{error}</Text>
                )}
                <div
                    style={{
                        marginTop: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    {canSignMaster && <Button onClick={reactivate}>{t('reactivateKey')}</Button>}
                    <Button variant={canSignMaster ? 'outlined' : 'contained'} onClick={onLogout}>
                        {t('logout')}
                    </Button>
                </div>
            </motion.div>
        </div>
    )
}
