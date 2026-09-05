import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { IconButton, List, ListItem, OverlaySurface, Text, TextField } from '@concrnt/ui'
import { MdCheck, MdClose } from 'react-icons/md'
import type { MediaDraft } from '../contexts/ComposerDraft'
import { CssVar } from '../types/Theme'
import styles from './ComposerMediaEditor.module.css'

const knownFlags = ['warn', 'nude', 'porn', 'hard']

interface Props {
    open: boolean
    media?: MediaDraft
    onClose: () => void
    onFlagChange: (flag: string | undefined) => void
}

export const ComposerMediaEditor = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.composer' })
    const { t: commonT } = useTranslation('', { keyPrefix: 'common' })
    const dialogRef = useRef<HTMLDivElement>(null)
    const previewUrl = props.media?.previewUrl
    const isOpen = props.open && previewUrl !== undefined

    useEffect(() => {
        if (!isOpen) return
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0)
        return () => {
            window.clearTimeout(focusTimer)
            if (previousFocus?.isConnected) previousFocus.focus()
        }
    }, [isOpen])

    const flagLabels: Record<string, string> = {
        warn: t('flagWarn'),
        nude: t('flagNude'),
        porn: t('flagPorn'),
        hard: t('flagHard')
    }
    const currentFlag = props.media?.flag

    return (
        <OverlaySurface open={isOpen} onClose={props.onClose}>
            <motion.div
                style={{
                    position: 'fixed',
                    inset: 0,
                    padding:
                        'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={props.onClose}
            >
                <motion.div
                    className={styles.dialog}
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('mediaEditTitle')}
                    tabIndex={-1}
                    style={{
                        width: 'min(960px, 100%)',
                        maxHeight: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        backgroundColor: CssVar.contentBackground,
                        color: CssVar.contentText,
                        borderRadius: CssVar.round(2)
                    }}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return
                        if (e.key === 'Escape') {
                            e.preventDefault()
                            props.onClose()
                            return
                        }
                        if (e.key !== 'Tab') return
                        const focusable = Array.from(
                            e.currentTarget.querySelectorAll<HTMLElement>(
                                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                            )
                        )
                        if (focusable.length === 0) {
                            e.preventDefault()
                            return
                        }
                        const first = focusable[0]
                        const last = focusable[focusable.length - 1]
                        if (
                            e.shiftKey &&
                            (document.activeElement === first || document.activeElement === e.currentTarget)
                        ) {
                            e.preventDefault()
                            last.focus()
                        } else if (!e.shiftKey && document.activeElement === last) {
                            e.preventDefault()
                            first.focus()
                        }
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            padding: `${CssVar.space(1)} ${CssVar.space(2)}`,
                            borderBottom: `1px solid ${CssVar.divider}`
                        }}
                    >
                        <IconButton title={commonT('close')} onClick={props.onClose}>
                            <MdClose size={24} />
                        </IconButton>
                    </div>
                    <div className={styles.body}>
                        <div
                            className={styles.preview}
                            style={{
                                flex: '2 1 420px',
                                minWidth: 'min(100%, 280px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: CssVar.space(2),
                                boxSizing: 'border-box',
                                backgroundColor: 'black'
                            }}
                        >
                            {previewUrl && (
                                <img
                                    src={previewUrl}
                                    alt=""
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain'
                                    }}
                                />
                            )}
                        </div>
                        <div
                            style={{
                                flex: '1 1 260px',
                                minWidth: 'min(100%, 240px)',
                                padding: CssVar.space(2),
                                boxSizing: 'border-box'
                            }}
                        >
                            <Text style={{ margin: 0, fontWeight: 'bold' }}>{t('flagTitle')}</Text>
                            <List disablePadding style={{ marginTop: CssVar.space(1) }}>
                                <ListItem
                                    endIcon={currentFlag === undefined ? <MdCheck size={20} /> : undefined}
                                    onClick={() => props.onFlagChange(undefined)}
                                >
                                    {t('flagNone')}
                                </ListItem>
                                {knownFlags.map((flag) => (
                                    <ListItem
                                        key={flag}
                                        endIcon={currentFlag === flag ? <MdCheck size={20} /> : undefined}
                                        onClick={() => props.onFlagChange(flag)}
                                    >
                                        {flagLabels[flag]}
                                    </ListItem>
                                ))}
                            </List>
                            <div style={{ marginTop: CssVar.space(1) }}>
                                <TextField
                                    placeholder={t('flagCustomPlaceholder')}
                                    value={
                                        currentFlag !== undefined && !knownFlags.includes(currentFlag)
                                            ? currentFlag
                                            : ''
                                    }
                                    onChange={(e) =>
                                        props.onFlagChange(e.target.value === '' ? undefined : e.target.value)
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </OverlaySurface>
    )
}
