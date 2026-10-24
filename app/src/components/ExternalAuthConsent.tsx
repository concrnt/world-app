// CIP-17 §6: 外部サービス (RP) へのログインの同意画面。
// Authorization Request URI (QR でも deep link でも同じ) を受け取り、検証 → 同意 → 署名 → 送信まで行う。
// 応答方式は URI の <response_mode> で決まり、開き方には依らない。
//   direct_post: 別端末の画面へのログイン。RP の画面に出ている絵文字 (display_code) を 3 択から選ばせ、
//                正解を選んだことを承認とみなす (見比べを操作そのものに組み込み、注意文を減らす)
//   fragment:    この端末のブラウザに戻る。見比べる画面が無いので「ログイン / 拒否」ボタンだけ
import { useEffect, useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Avatar, Button, Chip, Text } from '@concrnt/ui'
import { EMOJIHASH_TABLE } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
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
    | { kind: 'done'; message: 'approved' | 'approvedFragment' | 'denied' | 'mismatch' }
    | { kind: 'error'; code: ExternalAuthErrorCode }

const CHOICE_COUNT = 3

export const ExternalAuthConsent = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.externalAuth' })
    const { client } = useClient()
    const [state, setState] = useState<State>({ kind: 'loading' })

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

    // 3 択の候補 (正解 1 + ランダム 2)。要求ごとに 1 回だけ作り、送信中の再描画で並びが変わらないようにする
    const displayCode = state.kind === 'consent' ? state.request.display_code : null
    const choices = useMemo(() => (displayCode === null ? [] : buildChoices(displayCode)), [displayCode])

    // §8.1 / §8.2: 応答は redirect_uri へ。配送方法は URI の <response_mode> で決まる (Request Object には無い)
    const deliver = (uri: AuthorizationRequestUri, request: RequestObject, params: Record<string, string>) =>
        uri.responseMode === 'fragment'
            ? openFragmentResponse(request.redirect_uri, params)
            : postResponse(request.redirect_uri, params)

    const approve = async (uri: AuthorizationRequestUri, request: RequestObject) => {
        setState({ kind: 'consent', uri, request, submitting: true })
        try {
            const idToken = await buildIdToken(client, request, uri.origin) // ここで端末認証が出る
            await deliver(uri, request, { id_token: idToken })
            setState({ kind: 'done', message: uri.responseMode === 'fragment' ? 'approvedFragment' : 'approved' })
            props.onComplete('approved')
        } catch (e) {
            setState({ kind: 'error', code: e instanceof ExternalAuthError ? e.code : 'signFailed' })
        }
    }

    const deny = async (uri: AuthorizationRequestUri, request: RequestObject, message: 'denied' | 'mismatch') => {
        setState({ kind: 'consent', uri, request, submitting: true })
        // §8.3: 拒否の通知は MAY。届かなくてもユーザーの操作としては完了しているので結果は変えない
        try {
            await deliver(uri, request, { error: 'access_denied' })
        } catch {
            // 通知失敗は無視する
        }
        setState({ kind: 'done', message })
        props.onComplete('denied')
    }

    // 絵文字の 3 択。正解なら承認、違うものを選んだら照合失敗として拒否する。
    // (選び直しを許すと 3 回で必ず当たるので、1 回の選択で決める)
    const choose = (uri: AuthorizationRequestUri, request: RequestObject, choice: string) =>
        choice === request.display_code ? approve(uri, request) : deny(uri, request, 'mismatch')

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
    const sharesProfile = request.scope.split(' ').includes('profile')
    // §6: direct_post は別端末の画面へのログインなので display_code の照合を操作に組み込む。
    // fragment では display_code は Request Object にあっても使わない
    const isRemote = uri.responseMode === 'direct_post'
    const sharedInfo = [t('shareCcid'), t('shareDomain', { domain: client.server.domain })]
    if (sharesProfile) sharedInfo.push(t('shareProfile'))

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                // 画面下の FAB (60px + 余白) に操作ボタンが隠れないよう、スクロールで逃がせる余白を取る
                paddingBottom: CssVar.space(20)
            }}
        >
            {/* 「[アカウント] でログイン」。アカウントはチップで見せる (タップしても何も起きない) */}
            <Text
                variant="h4"
                style={{ margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: CssVar.space(1) }}
            >
                <Trans
                    t={t}
                    i18nKey="consentTitle"
                    components={{
                        user: (
                            <Chip
                                variant="outlined"
                                style={{ maxWidth: '100%', height: '28px', fontSize: '1rem' }}
                                headElement={
                                    <Avatar
                                        ccid={client.ccid}
                                        src={client.profile.avatar}
                                        style={{ width: 22, height: 22, flexShrink: 0 }}
                                    />
                                }
                            >
                                <span
                                    style={{
                                        display: 'block',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {client.profile.username || client.ccid}
                                </span>
                            </Chip>
                        )
                    }}
                />
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
                <Text variant="caption" style={{ margin: 0, marginTop: CssVar.space(0.5) }}>
                    {t('sharedInfoTitle')}: {sharedInfo.join(' / ')}
                </Text>
            </div>

            {isRemote ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1.5) }}>
                    <Text style={{ margin: 0 }}>{t('emojiPrompt')}</Text>
                    <div
                        role="group"
                        aria-label={t('emojiPrompt')}
                        style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(1) }}
                    >
                        {choices.map((choice) => (
                            <Button
                                key={choice}
                                disabled={submitting}
                                onClick={() => choose(uri, request, choice)}
                                style={{
                                    width: '100%',
                                    fontSize: '1.75rem',
                                    lineHeight: 1.3,
                                    letterSpacing: '0.1em',
                                    padding: `${CssVar.space(1.5)} ${CssVar.space(2)}`
                                }}
                            >
                                {choice}
                            </Button>
                        ))}
                    </div>
                    <Button
                        variant="outlined"
                        disabled={submitting}
                        onClick={() => deny(uri, request, 'denied')}
                        style={{ width: '100%' }}
                    >
                        {t('notInList')}
                    </Button>
                    {submitting && (
                        <Text variant="caption" style={{ margin: 0, textAlign: 'center' }}>
                            {t('submitting')}
                        </Text>
                    )}
                </div>
            ) : (
                <div
                    style={{ display: 'flex', justifyContent: 'flex-end', gap: CssVar.space(1), alignItems: 'center' }}
                >
                    {submitting && <Text variant="caption">{t('submitting')}</Text>}
                    <Button variant="outlined" disabled={submitting} onClick={() => deny(uri, request, 'denied')}>
                        {t('deny')}
                    </Button>
                    <Button disabled={submitting} onClick={() => approve(uri, request)}>
                        {t('approve')}
                    </Button>
                </div>
            )}
        </div>
    )
}

// 正解 1 つとランダムな偽物 2 つを混ぜて並べる。偽物は worldlib の emojihash と同じ表から、
// 正解と同じ文字数 (グラフェム数) で作る。正解や互いと同じ文字列にはしない
const buildChoices = (correct: string): string[] => {
    const length = Math.max(1, countGraphemes(correct))
    const choices = [correct]
    while (choices.length < CHOICE_COUNT) {
        const decoy = randomCode(length)
        if (!choices.includes(decoy)) choices.push(decoy)
    }
    return shuffle(choices)
}

const randomCode = (length: number): string => {
    const values = crypto.getRandomValues(new Uint32Array(length))
    return Array.from(values, (v) => EMOJIHASH_TABLE[v % EMOJIHASH_TABLE.length]).join('')
}

// 絵文字は複数コードポイント (☀️ など) で 1 文字になるので、Intl.Segmenter があればそれで数える
const countGraphemes = (text: string): number => {
    const Segmenter = (Intl as unknown as { Segmenter?: new () => { segment: (s: string) => Iterable<unknown> } })
        .Segmenter
    if (Segmenter) return Array.from(new Segmenter().segment(text)).length
    return Array.from(text).length
}

const shuffle = <T,>(items: T[]): T[] => {
    const result = [...items]
    const randoms = crypto.getRandomValues(new Uint32Array(result.length))
    for (let i = result.length - 1; i > 0; i--) {
        const j = randoms[i] % (i + 1)
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}
