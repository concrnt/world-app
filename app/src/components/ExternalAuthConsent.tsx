// CIP-17 §6: 外部サービス (RP) へのログインの同意画面。
// Authorization Request URI (QR でも deep link でも同じ) を受け取り、検証 → 同意 → 署名 → 送信まで行う。
// 応答方式は URI の <response_mode> で決まり、開き方には依らない
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
    openFragmentResponse,
    parseAuthorizationRequestUri,
    postResponse,
    type AuthorizationRequestUri,
    type ExternalAuthErrorCode,
    type RequestObject
} from '../lib/externalAuth'

interface Props {
    uri: string
    onComplete: (result: 'approved' | 'denied') => void
}

type State =
    | { kind: 'loading' }
    | { kind: 'consent'; uri: AuthorizationRequestUri; request: RequestObject; submitting: boolean }
    | { kind: 'done'; message: 'approved' | 'approvedFragment' | 'denied' }
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
                const uri = parseAuthorizationRequestUri(props.uri)
                const request = await fetchRequestObject(uri)
                if (!cancelled) setState({ kind: 'consent', uri, request, submitting: false })
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

    // §8.1 / §8.2: 応答は redirect_uri へ。配送方法は URI の <response_mode> で決まる (Request Object には無い)
    const deliver = (uri: AuthorizationRequestUri, request: RequestObject, params: Record<string, string>) =>
        uri.responseMode === 'fragment'
            ? openFragmentResponse(request.redirect_uri, params)
            : postResponse(request.redirect_uri, params)

    const approve = async (uri: AuthorizationRequestUri, request: RequestObject) => {
        setState({ kind: 'consent', uri, request, submitting: true })
        try {
            const idToken = await buildIdToken(client, request, uri.origin) // ここで端末認証が出る
            await deliver(uri, request, {
                id_token: idToken,
                ...(request.state !== undefined ? { state: request.state } : {})
            })
            setKnownOrigins((prev) => (prev.includes(uri.origin) ? prev : [...prev, uri.origin]))
            setState({ kind: 'done', message: uri.responseMode === 'fragment' ? 'approvedFragment' : 'approved' })
            props.onComplete('approved')
        } catch (e) {
            setState({ kind: 'error', code: e instanceof ExternalAuthError ? e.code : 'signFailed' })
        }
    }

    const deny = async (uri: AuthorizationRequestUri, request: RequestObject) => {
        setState({ kind: 'consent', uri, request, submitting: true })
        // §8.3: 拒否の通知は MAY。届かなくてもユーザーの操作としては完了しているので結果は変えない
        try {
            await deliver(uri, request, {
                error: 'access_denied',
                ...(request.state !== undefined ? { state: request.state } : {})
            })
        } catch {
            // 通知失敗は無視する
        }
        setState({ kind: 'done', message: 'denied' })
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
        return <Text variant="h3">{t(state.message)}</Text>
    }

    const { uri, request, submitting } = state
    const host = new URL(uri.origin).host
    const clientName = request.client_metadata?.client_name
    const isFirstTime = !knownOrigins.includes(uri.origin)
    const sharesProfile = request.scope.split(' ').includes('profile')
    // §6: direct_post は別端末の画面へのログイン。読み方 (QR / deep link) に関わらず照合コードと警告を必ず出す。
    // fragment では display_code は Request Object にあっても表示しない
    const isRemote = uri.responseMode === 'direct_post'
    const sharedInfo = [t('shareCcid'), t('shareDomain', { domain: client.server.domain })]
    if (sharesProfile) sharedInfo.push(t('shareProfile'))

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(1.5),
                // 画面下の FAB (60px + 余白) に操作ボタンが隠れないよう、スクロールで逃がせる余白を取る
                paddingBottom: CssVar.space(20)
            }}
        >
            <Text variant="h4" style={{ margin: 0 }}>
                {t('consentTitle')}
            </Text>

            {/* §6: RP の身元はオリジンの host。client_name は自己申告なので host を置き換えない (§10.5) */}
            <div
                style={{
                    border: `1px solid ${CssVar.divider}`,
                    borderRadius: '8px',
                    padding: `${CssVar.space(1)} ${CssVar.space(1.5)}`,
                    display: 'flex',
                    flexDirection: 'column'
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

            {isFirstTime && (
                <Text variant="caption" style={{ margin: 0, fontWeight: 'bold', color: 'inherit' }}>
                    {t('firstTimeWarning')}
                </Text>
            )}

            {/* direct_post: 照合コードを相手の画面と見比べさせ、自分で開いた要求でなければ拒否するよう促す (§6, §10.1)。
                fragment (この端末のブラウザに戻る) では見比べる画面が無いので出さない */}
            {isRemote && (
                <div
                    style={{
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: '8px',
                        padding: `${CssVar.space(1)} ${CssVar.space(1.5)}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: CssVar.space(0.5)
                    }}
                >
                    <Text variant="caption" style={{ margin: 0 }}>
                        {t('displayCode')}
                    </Text>
                    <Text style={{ margin: 0, fontSize: '2rem', lineHeight: 1.2, textAlign: 'center' }}>
                        {request.display_code}
                    </Text>
                    <Text variant="caption" style={{ margin: 0, textAlign: 'center' }}>
                        {t('displayCodeHint')}
                    </Text>
                    <Text
                        variant="caption"
                        style={{ margin: 0, marginTop: CssVar.space(0.5), fontWeight: 'bold', color: 'inherit' }}
                    >
                        {t('remoteLoginWarning')}
                    </Text>
                </div>
            )}

            <div>
                <Text variant="caption" style={{ margin: 0 }}>
                    {t('signingAs')}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1), minWidth: 0 }}>
                    <Avatar
                        ccid={client.ccid}
                        src={client.profile.avatar}
                        style={{ width: 32, height: 32, flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <Text style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {client.profile.username}
                        </Text>
                        <Text
                            variant="caption"
                            style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                            {client.ccid}
                        </Text>
                    </div>
                </div>
            </div>

            <div>
                <Text variant="caption" style={{ margin: 0 }}>
                    {t('sharedInfoTitle')}
                </Text>
                <Text style={{ margin: 0 }}>{sharedInfo.join(' / ')}</Text>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1), alignItems: 'center' }}>
                {submitting && <Text variant="caption">{t('submitting')}</Text>}
                <Button variant="outlined" disabled={submitting} onClick={() => deny(uri, request)}>
                    {t('deny')}
                </Button>
                <Button disabled={submitting} onClick={() => approve(uri, request)}>
                    {t('approve')}
                </Button>
            </div>
        </div>
    )
}
