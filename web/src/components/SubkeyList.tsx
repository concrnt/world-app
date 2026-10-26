import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Chip, Confirm, CopyButton, IconButton, ListItem, Modal, Text, TextField, useAnchor } from '@concrnt/ui'
import { MdMoreHoriz } from 'react-icons/md'
import { Select } from './Select'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { useThemeLibrary } from '../contexts/Theme'
import { ComputeCKID, GenerateIdentity, type Document, type SignedDocument } from '@concrnt/client'
import { emojihash, semantics, SignalLoginReceiver, type Client } from '@concrnt/worldlib'
import { QRCode } from 'react-qrcode-logo'

interface SubkeyEntry {
    key: string
    ckid: string
    name?: string
    status: 'active' | 'revoked'
    enactedAt?: Date
    revokedAt?: Date
    sd: SignedDocument
}

// ID管理画面に表示するサブキーの一覧。有効なサブキーはCIP-13にしたがい、
// enactドキュメントをrevoked-subkeyドキュメント(valueにenactのSignedDocumentを
// そのまま埋め込む)で同一キー上書きすることで失効させられる。
// value.name はworld-app独自の任意フィールド(表示用ラベル。検証には使われない)。
export const SubkeyList = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.id.subkeys' })
    const { client } = useClient()
    const [entries, setEntries] = useState<SubkeyEntry[] | null>(null)
    const [error, setError] = useState('')
    const [revokeTarget, setRevokeTarget] = useState<SubkeyEntry | null>(null)
    const [addOpen, setAddOpen] = useState(false)

    const currentCKID = client?.api.authProvider.getCKID()
    const canSignMaster = client?.api.authProvider.canSignMaster() ?? false

    const fetchEntries = useCallback(async (): Promise<SubkeyEntry[]> => {
        if (!client) return []
        const results = await client.api.queryAll({
            prefix: `cckv://${client.ccid}/keys/`
        })
        const parsed: SubkeyEntry[] = []
        for (const sd of results) {
            try {
                const doc: Document<any> = JSON.parse(sd.document)
                if (doc.schema === 'https://schema.concrnt.net/subkey.json') {
                    parsed.push({
                        key: sd.cckv,
                        ckid: doc.value.ckid,
                        name: typeof doc.value.name === 'string' && doc.value.name ? doc.value.name : undefined,
                        status: 'active',
                        enactedAt: new Date(doc.createdAt),
                        sd
                    })
                } else if (doc.schema === 'https://schema.concrnt.net/revoked-subkey.json') {
                    const enact: Document<any> = JSON.parse(doc.value.document)
                    parsed.push({
                        key: sd.cckv,
                        ckid: enact.value?.ckid ?? '',
                        name: typeof enact.value?.name === 'string' && enact.value.name ? enact.value.name : undefined,
                        status: 'revoked',
                        enactedAt: new Date(enact.createdAt),
                        revokedAt: new Date(doc.createdAt),
                        sd
                    })
                }
            } catch (err) {
                console.error('failed to parse subkey document', err)
            }
        }
        return parsed
    }, [client])

    useEffect(() => {
        fetchEntries()
            .then((parsed) => {
                setEntries(parsed)
                setError('')
            })
            .catch((err) => {
                console.error('failed to load subkeys', err)
                setEntries([])
                setError(t('loadFailed'))
            })
    }, [fetchEntries, t])

    if (!client) return null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: CssVar.space(2) }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5), flex: 1, minWidth: 0 }}>
                    <Text variant="h3">{t('title')}</Text>
                    <Text variant="caption">{t('description')}</Text>
                </div>
                <Button variant="outlined" onClick={() => setAddOpen(true)} style={{ flexShrink: 0 }}>
                    {t('add')}
                </Button>
            </div>
            {error && <Text style={{ color: '#ff7676' }}>{error}</Text>}
            {entries === null ? (
                <Text variant="caption">{t('loading')}</Text>
            ) : entries.length === 0 ? (
                <Text variant="caption">{t('empty')}</Text>
            ) : (
                entries.map((entry) => (
                    <SubkeyRow
                        key={entry.key}
                        entry={entry}
                        current={entry.ckid === currentCKID}
                        canSignMaster={canSignMaster}
                        onRevoke={() => setRevokeTarget(entry)}
                    />
                ))
            )}
            {!canSignMaster && <Text variant="caption">{t('masterKeyRequired')}</Text>}
            {/* 左右2カラム(通常項目 + QR)なので既定の 480px より広く取る */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} style={{ width: 'min(760px, 92vw)' }}>
                {addOpen && (
                    <NewSubkeyModalContent
                        client={client}
                        onClose={() => setAddOpen(false)}
                        onCreated={() => {
                            // 登録後もモーダルは閉じない(秘密鍵を控えてから閉じてもらう)。一覧だけ取り直す
                            fetchEntries()
                                .then((parsed) => setEntries(parsed))
                                .catch((err) => {
                                    console.error('failed to reload subkeys', err)
                                })
                        }}
                    />
                )}
            </Modal>
            <Confirm
                open={revokeTarget !== null}
                onClose={() => setRevokeTarget(null)}
                title={t('revokeConfirmTitle')}
                description={
                    revokeTarget?.ckid === currentCKID
                        ? t('revokeConfirmCurrentDescription')
                        : t('revokeConfirmDescription')
                }
                confirmText={t('revoke')}
                onConfirm={() => {
                    if (!revokeTarget) return
                    client.api
                        .commit(
                            {
                                kind: 'record',
                                key: revokeTarget.key,
                                author: client.ccid,
                                schema: 'https://schema.concrnt.net/revoked-subkey.json',
                                value: { document: revokeTarget.sd.document, proof: revokeTarget.sd.proof },
                                createdAt: new Date(),
                                onUpdate: 'retain'
                            },
                            client.server.domain,
                            { useMasterkey: true }
                        )
                        .then(() => fetchEntries())
                        .then((parsed) => {
                            setEntries(parsed)
                        })
                        .catch((err) => {
                            console.error('failed to revoke subkey', err)
                            setError(t('revokeFailed'))
                        })
                }}
            />
        </div>
    )
}

// このブラウザがログインに使っているサブキー文字列(ID管理直下にあったコピー処理の移設)。
// サブキーの秘密鍵はこのセッションのものしか手元に無いので、コピーできるのは現在使用中の行だけ。
const loadStoredSubkey = (): string | null => {
    let subkey = localStorage.getItem('SubKey')
    if (!subkey) return null
    // QRSetup経由のセッションはusePersistentがJSON文字列化して保存している
    if (subkey.startsWith('"')) {
        try {
            subkey = JSON.parse(subkey)
        } catch {
            /* raw文字列のまま使う */
        }
    }
    return subkey || null
}

const SubkeyRow = (props: { entry: SubkeyEntry; current: boolean; canSignMaster: boolean; onRevoke: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.id.subkeys' })
    const menuAnchor = useAnchor()
    const [menuOpen, setMenuOpen] = useState(false)
    const [copied, setCopied] = useState(false)

    const entry = props.entry
    const canCopy = props.current && entry.status === 'active' && loadStoredSubkey() !== null

    const options: ReactNode[] = []
    if (canCopy) {
        options.push(
            <ListItem
                key="copy"
                onClick={() => {
                    const subkey = loadStoredSubkey()
                    if (subkey) {
                        navigator.clipboard.writeText(subkey)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                    }
                    setMenuOpen(false)
                }}
            >
                <Text>{t('copy')}</Text>
            </ListItem>
        )
    }
    if (props.canSignMaster) {
        options.push(
            <ListItem
                key="revoke"
                onClick={() => {
                    setMenuOpen(false)
                    props.onRevoke()
                }}
            >
                <Text>{t('revoke')}</Text>
            </ListItem>
        )
    }

    return (
        <>
            <div
                style={{
                    border: `1px solid ${CssVar.divider}`,
                    borderRadius: '8px',
                    padding: CssVar.space(2),
                    display: 'flex',
                    alignItems: 'center',
                    gap: CssVar.space(2),
                    opacity: entry.status === 'revoked' ? 0.6 : 1
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(0.5),
                        minWidth: 0,
                        flex: 1
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1), minWidth: 0 }}>
                        <Text
                            style={{
                                margin: 0,
                                fontFamily: entry.name ? undefined : 'monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {entry.name ?? (entry.ckid || entry.key)}
                        </Text>
                        {props.current && (
                            <Chip variant="contained" style={{ fontSize: '12px', height: '20px' }}>
                                {t('current')}
                            </Chip>
                        )}
                    </div>
                    {entry.name && (
                        <Text
                            variant="caption"
                            style={{
                                margin: 0,
                                fontFamily: 'monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {entry.ckid || entry.key}
                        </Text>
                    )}
                    <Text variant="caption" style={{ margin: 0 }}>
                        {copied
                            ? t('copied')
                            : entry.status === 'active'
                              ? t('enactedAt', { date: entry.enactedAt?.toLocaleString() })
                              : t('validPeriod', {
                                    from: entry.enactedAt?.toLocaleString(),
                                    until: entry.revokedAt?.toLocaleString()
                                })}
                    </Text>
                </div>
                {entry.status === 'revoked' ? (
                    <Text variant="caption" style={{ margin: 0, flexShrink: 0 }}>
                        {t('revoked')}
                    </Text>
                ) : options.length > 0 ? (
                    <IconButton
                        title={t('menu')}
                        onClick={() => setMenuOpen(true)}
                        style={{ flexShrink: 0, anchorName: menuAnchor } as React.CSSProperties}
                    >
                        <MdMoreHoriz size={20} />
                    </IconButton>
                ) : null}
            </div>
            <Select open={menuOpen} onClose={() => setMenuOpen(false)} anchor={menuAnchor} options={options} />
        </>
    )
}

// 新しいサブキーをその場で生成し、秘密鍵文字列を見せた上で登録(enact)する。
// 秘密鍵はどこにも保存しないので、コピーできるのはこのモーダルを閉じるまでの間だけ。
// 登録後も閉じるまでは秘密鍵を表示したままにする(控え損ねを防ぐ)。
// 登録の経路は2つ: マスターキーがあればこの場で commit、無ければ QR(signal)をアプリに読ませて
// アプリ側の承認・commit を待つ(ログイン画面の QRSetup と同じ受信側の役割)。
const SIGNAL_HOST = 'signal.concrnt.net'

const NewSubkeyModalContent = (props: { client: Client; onClose: () => void; onCreated: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.id.subkeys' })
    const { t: tCommon } = useTranslation('', { keyPrefix: 'common' })
    const { theme } = useThemeLibrary()
    const [identity] = useState(() => GenerateIdentity())
    const [sessionID] = useState(() => crypto.randomUUID())
    const [name, setName] = useState('')
    const nameRef = useRef('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [scanned, setScanned] = useState(false)
    const [done, setDone] = useState(false)

    const client = props.client
    const canSignMaster = client.api.authProvider.canSignMaster()
    const ckid = ComputeCKID(identity.publicKey)
    const secret = `concrnt-subkey ${identity.privateKey} ${client.ccid}@${client.server.domain} -`
    // QR には CIP-17 と同じ concrnt-auth:// スキームで載せる(concrnt-auth://signal/<host>/<path> == wss://<host>/<path>)
    const signalURL = `wss://${SIGNAL_HOST}/${sessionID}`
    const qrValue = `concrnt-auth://signal/${SIGNAL_HOST}/${sessionID}`

    useEffect(() => {
        if (done) return
        const receiver = new SignalLoginReceiver(
            signalURL,
            async (ccid: string): Promise<string> => {
                // 別アカウントのアプリで読まれた場合は拒否する(throw すると Receiver は init を捨てて待ち直す)
                if (ccid !== client.ccid) {
                    setError(t('qrAccountMismatch'))
                    throw new Error('scanned by a different account')
                }
                setError('')
                setScanned(true)
                return ckid
            },
            () => {
                setDone(true)
                props.onCreated()
            },
            { keyName: () => nameRef.current.trim() || undefined }
        )
        return () => {
            receiver.dispose()
        }
        // 接続はチャンネルごとに1回。完了したら切る
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signalURL, done])

    const register = async () => {
        setBusy(true)
        setError('')
        try {
            const trimmed = name.trim()
            const doc: Document<{ ckid: string; name?: string }> = {
                kind: 'record',
                key: semantics.subkey(client.ccid, ckid),
                author: client.ccid,
                schema: 'https://schema.concrnt.net/subkey.json',
                value: trimmed ? { ckid, name: trimmed } : { ckid },
                createdAt: new Date(),
                onUpdate: 'retain'
            }
            const committed = await client.api.commit(doc, client.server.domain, { useMasterkey: true })
            if (!committed) throw new Error('commit returned empty result')
            setDone(true)
            props.onCreated()
        } catch (err) {
            console.error('failed to enact subkey', err)
            setError(t('addFailed'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                // CenterDialog は top 30% 固定で max-height が無いので、内容側で収める
                maxHeight: 'calc(70vh - 32px)',
                overflowY: 'auto'
            }}
        >
            <Text variant="h3">{done ? t('registered') : t('add')}</Text>

            {/* 左: 名前・ckid・秘密鍵の通常コンポーネント / 右: アプリに読ませる QR。幅が足りなければ QR が下に回る */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: CssVar.space(3), alignItems: 'flex-start' }}>
                <div
                    style={{
                        flex: '1 1 300px',
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2)
                    }}
                >
                    {!done && (
                        <>
                            <TextField
                                placeholder={t('namePlaceholder')}
                                value={name}
                                disabled={busy}
                                onChange={(e) => {
                                    nameRef.current = e.target.value
                                    setName(e.target.value)
                                }}
                            />
                        </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(0.5) }}>
                        <Text variant="caption" style={{ margin: 0 }}>
                            {t('secret')}
                        </Text>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(1),
                                border: `1px solid ${CssVar.divider}`,
                                borderRadius: '8px',
                                padding: CssVar.space(1)
                            }}
                        >
                            <Text
                                style={{
                                    margin: 0,
                                    flex: 1,
                                    minWidth: 0,
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    overflowWrap: 'anywhere',
                                    userSelect: 'all'
                                }}
                            >
                                {secret}
                            </Text>
                            <CopyButton text={secret} style={{ flexShrink: 0 }} />
                        </div>
                        <Text variant="caption" style={{ margin: 0 }}>
                            {t('secretNotice')}
                        </Text>
                    </div>
                </div>

                {!done && (
                    <div
                        style={{
                            flex: '0 1 300px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: CssVar.space(1),
                            textAlign: 'center',
                            margin: '0 auto'
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                maxWidth: 300,
                                aspectRatio: '1 / 1',
                                // canvas は CSS 変数を使えないので、解決済みテーマの content 色で塗る(台紙も不透明にして背景と同化させない)
                                backgroundColor: theme.content.background,
                                borderRadius: '8px'
                            }}
                        >
                            <QRCode
                                value={qrValue}
                                size={500}
                                ecLevel="L"
                                quietZone={50}
                                style={{ width: '100%', height: '100%' }}
                                fgColor={theme.content.text}
                                bgColor={theme.content.background}
                                qrStyle="fluid"
                                eyeRadius={10}
                            />
                        </div>
                        <Text variant="caption" style={{ margin: 0 }}>
                            {scanned ? t('qrScanned') : t('qrHint')}
                        </Text>
                        <Text style={{ margin: 0, fontSize: '2rem', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                            {emojihash(ckid)}
                        </Text>
                        <Text variant="caption" style={{ margin: 0 }}>
                            {t('qrEmojiHint')}
                        </Text>
                    </div>
                )}
            </div>

            {error && <Text style={{ color: '#ff7676', margin: 0 }}>{error}</Text>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1) }}>
                {done ? (
                    <Button onClick={props.onClose}>{tCommon('close')}</Button>
                ) : (
                    <>
                        <Button variant="text" disabled={busy} onClick={props.onClose}>
                            {tCommon('cancel')}
                        </Button>
                        {canSignMaster && (
                            <Button disabled={busy} onClick={register}>
                                {t('register')}
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
