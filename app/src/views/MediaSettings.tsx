import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, ListItem, Skeleton, Text, View } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { CssVar } from '../types/Theme'
import { useClient } from '../contexts/Client'
import { useConfirm } from '../contexts/Confirm'
import { useSelect } from '../contexts/Select'
import { useMediaViewer } from '../contexts/MediaViewer'
import { MdMoreHoriz } from 'react-icons/md'

interface StorageFile {
    id: string
    sha256: string
    url: string
    ownerId: string
    size: number
    mime: string
    cdate: string
}

interface FilesResponse {
    content: StorageFile[]
    next?: string
    prev?: string
}

interface StorageUser {
    id: string
    totalBytes: number
    quota: number
    cdate: string
    mdate: string
}

const PAGE_SIZE = 30

export const MediaSettingsView = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.mediaSettings' })
    const { client } = useClient()

    const [files, setFiles] = useState<StorageFile[]>([])
    const [storageUser, setStorageUser] = useState<StorageUser | null>(null)
    const [hasMoreData, setHasMoreData] = useState(true)
    const [loading, setLoading] = useState(false)
    const loadingRef = useRef(false)
    const nextCursorRef = useRef<string | undefined>(undefined)
    const scrollRef = useRef<HTMLDivElement>(null)

    const updateStorageUser = useCallback(() => {
        client.api
            .callConcrntApi<{ content: StorageUser }>(client.api.defaultHost, 'net.concrnt.storage.user', {})
            .then((res) => {
                setStorageUser(res.content)
            })
            .catch((e) => {
                console.error('Failed to fetch storage user', e)
            })
    }, [client])

    const readMore = useCallback(() => {
        if (loadingRef.current) return
        loadingRef.current = true
        setLoading(true)

        const args: Record<string, string> = { limit: `${PAGE_SIZE}` }
        if (nextCursorRef.current) args.before = nextCursorRef.current

        client.api
            .callConcrntApi<FilesResponse>(client.api.defaultHost, 'net.concrnt.storage.list', args)
            .then((res) => {
                setFiles((prev) => {
                    const seen = new Set(prev.map((f) => f.id))
                    return [...prev, ...res.content.filter((f) => !seen.has(f.id))]
                })
                nextCursorRef.current = res.next
                setHasMoreData(Boolean(res.next) && res.content.length > 0)
            })
            .catch((e) => {
                console.error('Failed to fetch files', e)
            })
            .finally(() => {
                loadingRef.current = false
                setLoading(false)
            })
    }, [client])

    const deleteFile = useCallback(
        (id: string) => {
            client.api
                .callConcrntApi(client.api.defaultHost, 'net.concrnt.storage.delete', { id }, { method: 'DELETE' })
                .then(() => {
                    setFiles((prev) => prev.filter((f) => f.id !== id))
                    updateStorageUser()
                })
                .catch((e) => {
                    console.error('Failed to delete file', e)
                })
        },
        [client, updateStorageUser]
    )

    useEffect(() => {
        updateStorageUser()
        // eslint-disable-next-line react-hooks/set-state-in-effect
        readMore()
    }, [updateStorageUser, readMore])

    // コンテンツがコンテナを満たしていない間はスクロールが発生しないため、埋まるまで追加読込する
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        if (!hasMoreData) return
        if (el.scrollHeight - el.clientHeight < 100) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            readMore()
        }
    }, [files, hasMoreData, readMore])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const handleScroll = () => {
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
                if (!hasMoreData) return
                readMore()
            }
        }

        el.addEventListener('scroll', handleScroll)
        return () => {
            el.removeEventListener('scroll', handleScroll)
        }
    }, [hasMoreData, readMore])

    const usagePercentage =
        storageUser && storageUser.quota > 0 ? (storageUser.totalBytes / storageUser.quota) * 100 : 0
    const usageGB = storageUser ? storageUser.totalBytes / 1000 / 1000 / 1000 : 0
    const quotaGB = storageUser ? storageUser.quota / 1000 / 1000 / 1000 : 0

    return (
        <View>
            <Header>{t('title')}</Header>
            <div
                ref={scrollRef}
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
                {storageUser && (
                    <div>
                        <Text>{t('storageQuota')}</Text>
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
                                    height: '8px',
                                    borderRadius: '4px',
                                    backgroundColor: CssVar.divider,
                                    overflow: 'hidden'
                                }}
                            >
                                <div
                                    style={{
                                        width: `${Math.min(usagePercentage, 100)}%`,
                                        height: '100%',
                                        backgroundColor: CssVar.uiBackground
                                    }}
                                />
                            </div>
                            <Text variant="caption">
                                {usageGB.toFixed(2)}GB / {quotaGB.toFixed(2)}GB
                            </Text>
                        </div>
                    </div>
                )}

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                        gap: CssVar.space(2)
                    }}
                >
                    {files.map((file) => (
                        <FileCard key={file.id} file={file} onDelete={deleteFile} />
                    ))}
                    {loading &&
                        Array.from({ length: 6 }, (_, i) => (
                            <Skeleton key={i} style={{ aspectRatio: '1', borderRadius: CssVar.round(1) }} />
                        ))}
                </div>

                {!loading && files.length === 0 && <Text style={{ opacity: 0.65 }}>{t('noFiles')}</Text>}
            </div>
        </View>
    )
}

const FileCard = (props: { file: StorageFile; onDelete: (id: string) => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'views.mediaSettings' })
    const { select, close } = useSelect()
    const confirm = useConfirm()
    const mediaViewer = useMediaViewer()

    const file = props.file
    const sizeMB = file.size / 1000 / 1000

    return (
        <div
            onClick={() => {
                mediaViewer.open([{ mediaURL: file.url, mediaType: file.mime }])
            }}
            style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: CssVar.round(1),
                overflow: 'hidden',
                border: `1px solid ${CssVar.divider}`,
                cursor: 'pointer'
            }}
        >
            {file.mime.startsWith('image/') ? (
                <img
                    src={file.url}
                    alt={file.id}
                    loading="lazy"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                    }}
                />
            ) : (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: CssVar.space(1),
                        overflowWrap: 'anywhere'
                    }}
                >
                    <Text variant="caption">{file.mime}</Text>
                </div>
            )}
            <IconButton
                variant="contained"
                onClick={(e) => {
                    e.stopPropagation()
                    select(`${new Date(file.cdate).toLocaleString()} · ${sizeMB.toFixed(2)}MB`, [
                        <ListItem
                            key="copyURL"
                            onClick={() => {
                                navigator.clipboard.writeText(file.url)
                                close()
                            }}
                        >
                            <Text>{t('copyURL')}</Text>
                        </ListItem>,
                        <ListItem
                            key="copyMarkdown"
                            onClick={() => {
                                navigator.clipboard.writeText(`![image](${file.url})`)
                                close()
                            }}
                        >
                            <Text>{t('copyMarkdown')}</Text>
                        </ListItem>,
                        <ListItem
                            key="delete"
                            onClick={() => {
                                confirm.open(
                                    t('deleteConfirmTitle'),
                                    () => {
                                        props.onDelete(file.id)
                                    },
                                    {
                                        description: t('deleteConfirmDescription'),
                                        confirmText: t('delete')
                                    }
                                )
                                close()
                            }}
                        >
                            <Text>{t('delete')}</Text>
                        </ListItem>
                    ])
                }}
                style={{
                    position: 'absolute',
                    top: CssVar.space(1),
                    right: CssVar.space(1)
                }}
            >
                <MdMoreHoriz size={18} />
            </IconButton>
        </div>
    )
}
