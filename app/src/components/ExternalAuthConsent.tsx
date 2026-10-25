// CIP-17 §6: 外部サービス (RP) へのログインの同意画面。
// Authorization Request URI (QR でも deep link でも同じ) を受け取り、検証 → 同意 → 署名 → 送信まで行う。
// 要求の内容はすべて URI に載っている (by-value) ので、同意の前に RP へ何かを取りに行くことは無い。
// 応答方式は URI の <type> で決まり、開き方には依らない。
//   post:     別端末の画面へのログイン。RP の画面に出ている絵文字 (display_code = emojihash(n)、付録 A) を
//             3 択から選ばせ、正解を選んだことを承認とみなす (見比べを操作そのものに組み込み、注意文を減らす)
//   fragment: この端末のブラウザに戻る。見比べる画面が無いので「ログイン / 拒否」ボタンだけ
import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { MdInfoOutline } from 'react-icons/md'
import { Avatar, Button, Chip, IconButton, Text } from '@concrnt/ui'
import { EMOJIHASH_TABLE, emojihash } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'
import { CssVar } from '../types/Theme'
import { Drawer } from '../ui/Drawer'
import {
    buildIdToken,
    ExternalAuthError,
    openFragmentResponse,
    parseAuthorizationRequestUri,
    postResponse,
    type AuthorizationRequestUri,
    type ExternalAuthErrorCode
} from '../lib/externalAuth'

interface Props {
    uri: string
    onComplete: (result: 'approved' | 'denied') => void
}

type State =
    | { kind: 'consent'; uri: AuthorizationRequestUri; submitting: boolean }
    | { kind: 'done'; message: 'approved' | 'approvedFragment' | 'denied' | 'mismatch' }
    | { kind: 'error'; code: ExternalAuthErrorCode }

// §5.3: URI の検証。取得は無いので同期で済む。失敗しても RP には何も送らない
const initialState = (text: string): State => {
    try {
        return { kind: 'consent', uri: parseAuthorizationRequestUri(text), submitting: false }
    } catch (e) {
        return { kind: 'error', code: e instanceof ExternalAuthError ? e.code : 'invalidUri' }
    }
}

const CHOICE_COUNT = 3

export const ExternalAuthConsent = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'app.externalAuth' })
    const { client } = useClient()
    const [state, setState] = useState<State>(() => initialState(props.uri))
    const [detailsOpen, setDetailsOpen] = useState(false)

    // display_code は RP も Authenticator も n から導出する (付録 A)。
    // 3 択の候補 (正解 1 + ランダム 2) は要求ごとに 1 回だけ作り、送信中の再描画で並びが変わらないようにする
    const displayCode = state.kind === 'consent' ? emojihash(state.uri.nonce) : null
    const choices = useMemo(() => (displayCode === null ? [] : buildChoices(displayCode)), [displayCode])

    // §8.1 / §8.2: 応答は送り先 URL へ。配送方法は URI の <type> で決まる
    const deliver = (uri: AuthorizationRequestUri, params: Record<string, string>) =>
        uri.responseMode === 'fragment'
            ? openFragmentResponse(uri.redirectUri, params)
            : postResponse(uri.redirectUri, params)

    const approve = async (uri: AuthorizationRequestUri) => {
        setState({ kind: 'consent', uri, submitting: true })
        try {
            const idToken = await buildIdToken(client, uri) // ここで端末認証が出る
            await deliver(uri, { id_token: idToken })
            setState({ kind: 'done', message: uri.responseMode === 'fragment' ? 'approvedFragment' : 'approved' })
            props.onComplete('approved')
        } catch (e) {
            setState({ kind: 'error', code: e instanceof ExternalAuthError ? e.code : 'signFailed' })
        }
    }

    const deny = async (uri: AuthorizationRequestUri, message: 'denied' | 'mismatch') => {
        setState({ kind: 'consent', uri, submitting: true })
        // §8.3: 拒否の通知は MAY。nonce を付けて RP がどの要求か分かるようにする。
        // 届かなくてもユーザーの操作としては完了しているので結果は変えない
        try {
            await deliver(uri, { error: 'access_denied', nonce: uri.nonce })
        } catch {
            // 通知失敗は無視する
        }
        setState({ kind: 'done', message })
        props.onComplete('denied')
    }

    // 絵文字の 3 択。正解なら承認、違うものを選んだら照合失敗として拒否する。
    // (選び直しを許すと 3 回で必ず当たるので、1 回の選択で決める。§6 MUST NOT)
    const choose = (uri: AuthorizationRequestUri, choice: string) =>
        choice === displayCode ? approve(uri) : deny(uri, 'mismatch')

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

    const { uri, submitting } = state
    const host = uri.host
    // §7.3: s に profile があるとき (省略時を含む) だけプロフィールも渡る
    const sharesProfile = uri.scope.includes('profile')
    // §6: post は別端末の画面へのログインなので display_code の照合を操作に組み込む。fragment では使わない
    const isRemote = uri.responseMode === 'post'

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
            {/* 「[アカウント] でログイン」+ i ボタン (サイトに渡る情報の詳細をドロワーで)。アカウントはチップで見せる */}
            <div style={{ display: 'flex', alignItems: 'center', gap: CssVar.space(1), minWidth: 0 }}>
                <Text
                    variant="h4"
                    style={{
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: CssVar.space(1),
                        minWidth: 0
                    }}
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
                <IconButton
                    title={t('details')}
                    onClick={() => setDetailsOpen(true)}
                    style={{ width: '1.5em', height: '1.5em', padding: 0, flexShrink: 0 }}
                >
                    <MdInfoOutline size="1.25em" />
                </IconButton>
            </div>
            <Drawer open={detailsOpen} onClose={() => setDetailsOpen(false)}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(2),
                        height: '100%',
                        overflowY: 'auto',
                        padding: '4px'
                    }}
                >
                    <div>
                        <Text variant="h2" style={{ margin: 0 }}>
                            {t('canTitle')}
                        </Text>
                        <ul style={{ margin: `${CssVar.space(1)} 0 0`, paddingLeft: '1.5em' }}>
                            <li>
                                <Text style={{ margin: 0 }}>{t('canKnowIdentity')}</Text>
                            </li>
                            {sharesProfile && (
                                <li>
                                    <Text style={{ margin: 0 }}>{t('canKnowProfile')}</Text>
                                </li>
                            )}
                        </ul>
                    </div>
                    <div>
                        <Text variant="h2" style={{ margin: 0 }}>
                            {t('cannotTitle')}
                        </Text>
                        <ul style={{ margin: `${CssVar.space(1)} 0 0`, paddingLeft: '1.5em' }}>
                            <li>
                                <Text style={{ margin: 0 }}>{t('cannotPost')}</Text>
                            </li>
                            <li>
                                <Text style={{ margin: 0 }}>{t('cannotRead')}</Text>
                            </li>
                        </ul>
                    </div>
                </div>
            </Drawer>

            {/* §6: RP の身元は送り先 URL の host。URI に自己申告 (名前・ロゴ) は無く、host 以外は表示しない */}
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
                                onClick={() => choose(uri, choice)}
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
                        onClick={() => deny(uri, 'denied')}
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
                    <Button variant="outlined" disabled={submitting} onClick={() => deny(uri, 'denied')}>
                        {t('deny')}
                    </Button>
                    <Button disabled={submitting} onClick={() => approve(uri)}>
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
