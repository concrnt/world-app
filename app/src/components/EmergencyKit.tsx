import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ReactNode, useEffect, useState } from 'react'
import { type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { deleteAllResourceCaches } from '../lib/cache'

import buildTime from '~build/time'
import { branch, sha } from '~build/git'
import { version } from '~build/package'

// This is the top-level crash screen: it must render even when @concrnt/ui or
// the theme provider is what crashed, so it must not depend on either.
// Theme CSS variables are referenced with Themes.blue values as fallbacks.
const uiText = 'var(--ui-text, #ffffff)'
const uiBackground = 'var(--ui-background, #0476d9)'

const messageSeed = Math.random()

const KitButton = (props: {
    children: ReactNode
    onClick?: () => void
    variant?: 'contained' | 'outlined'
    danger?: boolean
    big?: boolean
}) => {
    return (
        <button
            onClick={props.onClick}
            style={{
                width: '100%',
                minHeight: props.big ? 56 : 48,
                color: props.danger ? '#ff5b5b' : props.variant === 'outlined' ? uiText : uiBackground,
                backgroundColor: props.variant === 'outlined' ? 'transparent' : uiText,
                border: props.variant === 'outlined' ? `1px solid ${props.danger ? '#ff5b5b' : uiText}` : 'none',
                borderRadius: 'calc(var(--round, 4px) * 2)',
                fontSize: props.big ? '1.125rem' : '1rem',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                padding: '8px 16px'
            }}
        >
            {props.children}
        </button>
    )
}

export function EmergencyKit({ error }: FallbackProps): ReactNode {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const { t } = useTranslation('', { keyPrefix: 'emergency' })
    // window.alert is unreliable in Tauri webviews, so report feedback is shown inline
    const [reportStatus, setReportStatus] = useState<string | null>(null)

    useEffect(() => {
        // do not refresh in 5 minutes
        const lastQuickFix = localStorage.getItem('lastQuickFix')
        if (lastQuickFix) {
            const diff = new Date().getTime() - new Date(lastQuickFix).getTime()
            if (diff < 5 * 60 * 1000) {
                return
            }
        }

        if (
            errorMessage.includes('Failed to fetch dynamically imported module') ||
            errorMessage.includes("'text/html' is not a valid JavaScript MIME type")
        ) {
            localStorage.setItem('lastQuickFix', new Date().toISOString())
            window.location.reload()
        }
    }, [errorMessage])

    const cleanReload = async (): Promise<void> => {
        localStorage.removeItem('lastQuickFix')
        await deleteAllResourceCaches().catch(() => {})
        window.location.reload()
    }

    // login keys live in the OS keychain, so clearing localStorage keeps the login
    const softReset = async (): Promise<void> => {
        localStorage.clear()
        await deleteAllResourceCaches().catch(() => {})
        window.location.reload()
    }

    const hardReset = async (): Promise<void> => {
        localStorage.clear()
        await deleteAllResourceCaches().catch(() => {})
        await invoke('clear_session')
        window.location.reload()
    }

    const report = `# Crash Report
Time: ${new Date().toISOString()}
Error: ${errorMessage}
Stack: ${errorStack}
UserAgent: ${navigator.userAgent}
Language: ${navigator.language}
Location: ${window.location.href}
Referrer: ${document.referrer}
Screen: ${window.screen.width}x${window.screen.height}
Viewport: ${window.innerWidth}x${window.innerHeight}

version: ${version}
branch: ${branch}
sha: ${sha}
buildTime: ${buildTime.toLocaleString()}`

    const sendReport = (): void => {
        // TODO: this blob is XOR-keyed with the v1 official hostname; regenerate it
        // for the v2 host with: btoa(url.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ host.charCodeAt(i % host.length))).join(''))
        const source =
            'CxsaEwFUWwETBgEPCxELQAAdA1tPBwZdGwEBBwEMGR1bH0RdRVpVWllbVUtaRBtGVkddUExfLS1DKA5iExolVA00PAg8PV0MAz0COSlVCwI/LEReHxwkFyIFXBVCNlQtPzt3MyIhHC0KIAJVPhslTQcpEC4sMykLOQ=='
        const key = window.location.hostname
        const url = window
            .atob(source)
            .split('')
            .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
            .join('')

        if (!url.startsWith('https://')) {
            setReportStatus(t('reportFailed'))
            return
        }

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: report })
        }).then(() => {
            setReportStatus(t('reportSent'))
        })
    }

    const messages = t('messages', { returnObjects: true }) as string[]
    const message = messages[(messages.length * messageSeed) | 0]

    return (
        <div
            style={{
                minHeight: '100dvh',
                width: '100dvw',
                padding: 'calc(env(safe-area-inset-top) + 32px) 20px calc(env(safe-area-inset-bottom) + 20px)',
                boxSizing: 'border-box',
                color: uiText,
                backgroundColor: uiBackground,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflowY: 'auto'
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 440,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20
                }}
            >
                <div
                    style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 8
                    }}
                >
                    <h1 style={{ margin: 0, fontSize: '2rem', lineHeight: 1.2, fontWeight: 700 }}>{t('title')}</h1>
                    <div style={{ opacity: 0.78, lineHeight: 1.7 }}>{message}</div>
                </div>
                <KitButton big onClick={cleanReload}>
                    {t('reload')}
                </KitButton>
                <div
                    style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: 12
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.2, textAlign: 'center' }}>
                        {t('recoverTools')}
                    </h2>
                    <div style={{ opacity: 0.78, lineHeight: 1.7, textAlign: 'center' }}>{t('whenToUseTools')}</div>
                    <KitButton variant="outlined" onClick={softReset}>
                        {t('softReset')}
                    </KitButton>
                    <KitButton variant="outlined" danger onClick={hardReset}>
                        {t('hardReset')}
                    </KitButton>
                </div>
                <div
                    style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: 12
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.2, textAlign: 'center' }}>
                        {t('support')}
                    </h2>
                    <div style={{ opacity: 0.78, lineHeight: 1.7, textAlign: 'center' }}>{t('supportDesc')}</div>
                    <a
                        href="https://discord.gg/M2UbHquT8B"
                        onClick={(e) => {
                            e.preventDefault()
                            openUrl('https://discord.gg/M2UbHquT8B')
                        }}
                        style={{ color: uiText, fontWeight: 700, textAlign: 'center' }}
                    >
                        Discord
                    </a>
                </div>
                <div
                    style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: 12
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.2, textAlign: 'center' }}>Report</h2>
                    <KitButton variant="outlined" onClick={sendReport}>
                        {t('sendAnonymousReport')}
                    </KitButton>
                    {reportStatus && (
                        <div style={{ opacity: 0.78, lineHeight: 1.7, textAlign: 'center' }}>{reportStatus}</div>
                    )}
                    <pre
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            margin: 0,
                            padding: 16,
                            borderRadius: 'calc(var(--round, 4px) * 2)',
                            backgroundColor: 'rgba(0, 0, 0, 0.25)',
                            fontSize: '0.75rem',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            textAlign: 'left'
                        }}
                    >
                        {report}
                    </pre>
                </div>
            </div>
        </div>
    )
}
