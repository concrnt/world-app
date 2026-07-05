import { useState } from 'react'
import { motion } from 'motion/react'
import { Button, CssVar, Text } from '@concrnt/ui'
import { Client, semantics } from '@concrnt/worldlib'

interface Props {
    client: Client
    onRecovered: () => Promise<void>
    onLogout: () => Promise<void>
}

// サーバーリセットや他デバイスからのrevokeでこのブラウザのsubkeyが失効した際に表示する、
// 閉じることのできない案内。マスターキーを保持していればその場で再有効化でき、
// 保持していなければログアウトして再ログインを促す。
export const SubkeyInvalidDrawer = ({ client, onRecovered, onLogout }: Props) => {
    const [error, setError] = useState('')
    const canSignMaster = client.api.authProvider.canSignMaster()
    const width = Math.min(typeof window !== 'undefined' ? window.innerWidth : 420, 420)

    const reactivate = async () => {
        setError('')
        try {
            const ccid = client.ccid
            const ckid = client.api.authProvider.getCKID()
            if (!ckid) throw new Error('この端末の鍵情報が見つかりませんでした。')

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
            setError('鍵の再有効化に失敗しました。時間をおいて再度お試しください。')
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
                <Text variant="h3">このデバイスの鍵が無効になっています</Text>
                <Text style={{ opacity: 0.8 }}>
                    サーバー側のリセット、または他のデバイスからの操作により、このブラウザで使用している鍵(サブキー)が失効しました。
                </Text>
                <Text style={{ opacity: 0.8 }}>
                    {canSignMaster
                        ? '「鍵を再有効化」を押すと、このブラウザの鍵を復旧できます。'
                        : '投稿など書き込みを行うには、一度ログアウトし、QRコードまたはマスターキーで再度ログインしてください。'}
                </Text>
                {error && <Text style={{ color: '#ff7676' }}>{error}</Text>}
                <div
                    style={{
                        marginTop: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    {canSignMaster && <Button onClick={reactivate}>鍵を再有効化</Button>}
                    <Button variant={canSignMaster ? 'outlined' : 'contained'} onClick={onLogout}>
                        ログアウト
                    </Button>
                </div>
            </motion.div>
        </div>
    )
}
