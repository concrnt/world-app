// CIP-17 §6: 外部サービス (RP) へのログインの同意画面。
// QR から読み取った Authorization Request URI を受け取り、検証 → 同意 → 署名 → 送信まで行う
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, Button, Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'
import { usePersistent } from '../hooks/usePersistent'
import { CssVar } from '../types/Theme'
import {
    buildIdToken,
    ExternalAuthError,
    fetchRequestObject,
    parseAuthorizationRequestUri,
    postResponse,
    type ExternalAuthErrorCode,
    type RequestObject
} from '../lib/externalAuth'

interface Props {
    uri: string
    onComplete: (result: 'approved' | 'denied') => void
}

type State =
    | { kind: 'loading' }
    | { kind: 'consent'; request: RequestObject; submitting: boolean }
    | { kind: 'done'; result: 'approved' | 'denied' }
    | { kind: 'error'; code: ExternalAuthErrorCode }

export const ExternalAuthConsent = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.externalAuth' })
    const { client } = useClient()
    const [state, setState] = useState<State>({ kind: 'loading' })

    // このアカウントで過去にログインした RP のオリジン。初回なら警告を出す (§6 SHOULD)。
    // localStorage はログアウトやアカウント切替で消えるが、消えても警告が再び出るだけなので許容する
    const [knownOrigins, setKnownOrigins] = usePersistent<string[]>(`externalAuth.knownOrigins.${client.ccid}`, [])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const request = await fetchRequestObject(parseAuthorizationRequestUri(props.uri))
                if (!cancelled) setState({ kind: 'consent', request, submitting: false })
            } catch (e) {
                if (!cancelled) {
                    setState({ kind: 'error', code: e instanceof ExternalAuthError ? e.code : 'invalidRequest' })
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [props.uri])

    const approve = async (request: RequestObject) => {
        setState({ kind: 'consent', request, submitting: true })
        try {
            const idToken = await buildIdToken(client, request) // ここで端末認証が出る
            await postResponse(request.client_id, {
                id_token: idToken,
                ...(request.state !== undefined ? { state: request.state } : {})
            })
            const origin = new URL(request.client_id).origin
            setKnownOrigins((prev) => (prev.includes(origin) ? prev : [...prev, origin]))
            setState({ kind: 'done', result: 'approved' })
            props.onComplete('approved')
        } catch (e) {
            setState({ kind: 'error', code: e instanceof ExternalAuthError ? e.code : 'signFailed' })
        }
    }

    const deny = async (request: RequestObject) => {
        setState({ kind: 'consent', request, submitting: true })
        // §8.3: 拒否の通知は MAY。届かなくてもユーザーの操作としては完了しているので結果は変えない
        try {
            await postResponse(request.client_id, {
                error: 'access_denied',
                ...(request.state !== undefined ? { state: request.state } : {})
            })
        } catch {
            // 通知失敗は無視する
        }
        setState({ kind: 'done', result: 'denied' })
        props.onComplete('denied')
    }

    if (state.kind === 'loading') {
        return <Text>{t('loading')}</Text>
    }

    if (state.kind === 'error') {
        return (
            <div>
                <Text variant="h3">{t('errorTitle')}</Text>
                <Text>{t(`errors.${state.code}`)}</Text>
                <Text variant="caption">{t('nothingSent')}</Text>
            </div>
        )
    }

    if (state.kind === 'done') {
        return <Text variant="h3">{t(state.result)}</Text>
    }

    const { request, submitting } = state
    const host = new URL(request.client_id).host
    const clientName = request.client_metadata?.client_name
    const isFirstTime = !knownOrigins.includes(new URL(request.client_id).origin)
    const sharesProfile = request.scope.split(' ').includes('profile')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(2) }}>
            <Text variant="h3" style={{ margin: 0 }}>
                {t('consentTitle')}
            </Text>

            {/* §6: RP の身元はオリジンの host。client_name は自己申告なので host を置き換えない (§10.5) */}
            <div
                style={{
                    border: `1px solid ${CssVar.divider}`,
                    borderRadius: '8px',
                    padding: CssVar.space(2),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(0.5)
                }}
            >
                <Text variant="caption" style={{ margin: 0 }}>
                    {t('siteLabel')}
                </Text>
                <Text variant="h4" style={{ margin: 0, wordBreak: 'break-all' }}>
                    {host}
                </Text>
                {clientName && (
                    <Text variant="caption" style={{ margin: 0 }}>
                        {t('selfReportedName', { name: clientName })}
                    </Text>
                )}
            </div>

            {isFirstTime && <Text style={{ margin: 0, fontWeight: 'bold' }}>{t('firstTimeWarning')}</Text>}

            {request.display_code && (
                <div>
                    <Text variant="caption" style={{ margin: 0 }}>
                        {t('displayCode')}
                    </Text>
                    <Text style={{ margin: 0, fontSize: '2rem', textAlign: 'center' }}>{request.display_code}</Text>
                </div>
            )}

            <div>
                <Text variant="caption" style={{ margin: 0 }}>
                    {t('signingAs')}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1), minWidth: 0 }}>
                    <Avatar ccid={client.ccid} src={client.profile.avatar} style={{ width: 40, height: 40 }} />
                    <div style={{ minWidth: 0 }}>
                        <Text style={{ margin: 0 }}>{client.profile.username}</Text>
                        <Text variant="caption" style={{ margin: 0, wordBreak: 'break-all' }}>
                            {client.ccid}
                        </Text>
                    </div>
                </div>
            </div>

            <div>
                <Text variant="caption" style={{ margin: 0 }}>
                    {t('sharedInfoTitle')}
                </Text>
                <ul style={{ margin: 0, paddingLeft: '1.5em' }}>
                    <li>
                        <Text style={{ margin: 0 }}>{t('shareCcid')}</Text>
                    </li>
                    <li>
                        <Text style={{ margin: 0 }}>{t('shareDomain', { domain: client.server.domain })}</Text>
                    </li>
                    {sharesProfile && (
                        <li>
                            <Text style={{ margin: 0 }}>{t('shareProfile')}</Text>
                        </li>
                    )}
                </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1), alignItems: 'center' }}>
                {submitting && <Text variant="caption">{t('submitting')}</Text>}
                <Button variant="outlined" disabled={submitting} onClick={() => deny(request)}>
                    {t('deny')}
                </Button>
                <Button disabled={submitting} onClick={() => approve(request)}>
                    {t('approve')}
                </Button>
            </div>
        </div>
    )
}
