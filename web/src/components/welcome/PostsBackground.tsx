import { CSSProperties, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../../types/Theme'
import { DummyMessage } from './DummyMessage'
import styles from './PostsBackground.module.css'

// 背景に浮かぶ投稿
export interface BackgroundPost {
    key: string
    // アバター画像が無いときのアイコンの元にする
    ccid: string
    username: string
    avatarURL?: string
    body: string
    // 投稿先タイムラインの表示名
    timelines: string[]
}

interface Shown {
    post: BackgroundPost
    style: CSSProperties
    // 置いたマス目の番号
    cell: number
    // 消え始めた(消える animation が始まった)。画面に残っている数には数えない
    leaving: boolean
}

// 画面に出しておく投稿の数。MIN_SHOWN を下回ったら次の tick ですぐ足すので、開いた直後も 1 秒以内に揃う
const MIN_SHOWN = 7
const MAX_SHOWN = 10
const TICK_MS = 120
// MIN_SHOWN 以上のときに 1 tick で足す確率。平均でおよそ 1.2 秒に 1 件になる
const SPAWN_CHANCE = 0.1
const PARALLAXES = [100, 500, 1000]
// 一様なランダムだと固まったり大きく空いたりするので、マス目に区切って空いているマスに置き、マスの中で揺らす。
// ページ全体は横 4 × 縦 4、左右の帯は左右それぞれ縦 6 段
const GRID_COLS = 4
const GRID_ROWS = 4
const BAND_ROWS = 6

// 本文の長さで幅がばらつかないよう、また画面端で縮んで細かく折り返さないよう幅を固定する
const postStyle: CSSProperties = {
    position: 'absolute',
    width: 320,
    boxSizing: 'border-box',
    backgroundColor: CssVar.contentBackground,
    borderRadius: '4px',
    border: `1px solid rgb(from ${CssVar.contentText} r g b / 0.1)`,
    padding: CssVar.space(2),
    // 実際の投稿は長いことがあるので、背景として収まる高さで切る
    maxHeight: 160,
    overflow: 'hidden'
}

// /welcome と招待ページの背景。空の状態から、ランダムな場所に投稿が現れてはしばらくして消えるのを繰り返す。
// スクロールに合わせてそれぞれの速さで流れる。
// avoidCenter: 見出しや説明文がそのまま背景に載る /welcome 用に、左右の端の帯にだけ出す(既定はページ全体)
// posts: デモの投稿に混ぜて出す投稿
export const PostsBackground = (props: { avoidCenter?: boolean; posts?: BackgroundPost[] }) => {
    const { t } = useTranslation('', { keyPrefix: 'web.welcome' })
    const [shown, setShown] = useState<Shown[]>([])

    const pool: BackgroundPost[] = [
        ...[
            { username: 'SkylerJay', body: t('crnt1') },
            { username: 'NovaPulse', body: t('crnt2') },
            { username: 'EchoBlaze', body: t('crnt3') },
            { username: 'RiverStone', body: t('crnt4') },
            { username: 'LunaDrift', body: t('crnt5') },
            { username: 'ZephyrWind', body: t('crnt6') },
            { username: 'CrystalWave', body: t('crnt7') },
            { username: 'OrionShade', body: t('crnt8') },
            { username: 'StarfallX', body: t('crnt9') },
            { username: 'EmberGlow', body: t('crnt10') },
            { username: 'SolarRay', body: t('crnt11') },
            { username: 'FrostWanderer', body: t('crnt12') },
            { username: 'MirageVibe', body: t('crnt13') },
            { username: 'ZenithRift', body: t('crnt14') },
            { username: 'totegamma', body: t('crnt_totegamma'), avatarURL: 'https://github.com/totegamma.png' }
        ].map((demo) => ({
            ...demo,
            key: demo.username,
            ccid: demo.username,
            // ダミーの投稿は架空の #welcome に投稿されたことにする
            timelines: ['welcome']
        })),
        ...(props.posts ?? [])
    ]
    // タイマーは出し入れを途切れさせないようマウント中ずっと回すので、後から増える投稿はrefで渡す
    const poolRef = useRef(pool)
    useEffect(() => {
        poolRef.current = pool
    })

    useEffect(() => {
        const timer = window.setInterval(() => {
            setShown((prev) => {
                const active = prev.filter((s) => !s.leaving).length
                if (active >= MAX_SHOWN || (active >= MIN_SHOWN && Math.random() >= SPAWN_CHANCE)) return prev
                const candidates = poolRef.current.filter((post) => !prev.some((s) => s.post.key === post.key))
                if (candidates.length === 0) return prev
                const post = candidates[Math.floor(Math.random() * candidates.length)]
                // 投稿が一番少ないマス(同数ならその中からランダム)。消えかけの投稿もまだ見えているので数に入れる
                const counts = Array.from(
                    { length: props.avoidCenter ? BAND_ROWS * 2 : GRID_COLS * GRID_ROWS },
                    () => 0
                )
                for (const s of prev) counts[s.cell]++
                const fewest = counts.flatMap((count, i) => (count === Math.min(...counts) ? [i] : []))
                const cell = fewest[Math.floor(Math.random() * fewest.length)]
                // 位置は投稿の左上なので、投稿の大きさのぶんずらして中心が散らばるようにする
                const position: CSSProperties = props.avoidCenter
                    ? {
                          top: `${5 + ((Math.floor(cell / 2) + Math.random()) / BAND_ROWS) * 85}%`,
                          [cell % 2 === 0 ? 'left' : 'right']: `${-20 + Math.random() * 20}%`
                      }
                    : {
                          top: `calc(${((Math.floor(cell / GRID_COLS) + Math.random()) / GRID_ROWS) * 100}% - 60px)`,
                          left: `calc(${(((cell % GRID_COLS) + Math.random()) / GRID_COLS) * 100}% - 160px)`
                      }
                const parallax = PARALLAXES[Math.floor(Math.random() * PARALLAXES.length)]
                const life = 8 + Math.random() * 12
                return [
                    ...prev,
                    {
                        post,
                        style: {
                            ...position,
                            // 消える animation の終わりで取り除く(onAnimationEnd)
                            animation: `${styles[`welcome-parallax-${parallax}`]} linear, ${styles.appear} 1s ease-out, ${styles.disappear} 1s ease-in ${life}s forwards`,
                            animationTimeline: 'scroll(), auto, auto'
                        },
                        cell,
                        leaving: false
                    }
                ]
            })
        }, TICK_MS)
        return () => window.clearInterval(timer)
    }, [props.avoidCenter])

    return (
        <div /* parallax decorations */
            style={{
                height: '100dvh',
                width: '100%',
                maxWidth: '1280px',
                position: 'fixed'
            }}
        >
            {shown.map(({ post, style }) => (
                <div
                    key={post.key}
                    style={{ ...postStyle, ...style }}
                    onAnimationStart={(e) => {
                        if (e.animationName !== styles.disappear) return
                        setShown((prev) => prev.map((s) => (s.post.key === post.key ? { ...s, leaving: true } : s)))
                    }}
                    onAnimationEnd={(e) => {
                        if (e.animationName !== styles.disappear) return
                        setShown((prev) => prev.filter((s) => s.post.key !== post.key))
                    }}
                >
                    <DummyMessage
                        dummyId={post.ccid}
                        username={post.username}
                        avatarURL={post.avatarURL}
                        body={post.body}
                        timelines={post.timelines}
                        timestamp={<></>}
                        style={{
                            opacity: 0.8,
                            color: 'gray'
                        }}
                    />
                </div>
            ))}
        </div>
    )
}
