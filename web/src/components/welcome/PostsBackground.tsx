import { CSSProperties, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../../types/Theme'
import { DummyMessage } from './DummyMessage'
import styles from './PostsBackground.module.css'

// 背景に後から足す投稿(招待ページでは招待のタイムラインの最近の投稿)
export interface BackgroundPost {
    key: string
    // アバター画像が無いときのアイコンの元にする
    ccid: string
    username: string
    avatarURL?: string
    body: string
    position: CSSProperties
}

// 中央から外に向かうランダムな位置。turn(0〜1 で一周)を渡す。
// 位置は投稿の左上なので、投稿の幅のぶん左へずらして中心が散らばるようにする
export const scatterPosition = (turn: number): CSSProperties => {
    const angle = turn * 2 * Math.PI
    const radius = 15 + Math.random() * 35
    return { top: `${50 + Math.sin(angle) * radius}%`, left: `${35 + Math.cos(angle) * radius}%` }
}

// 本文の長さで幅がばらつかないよう、また画面端で縮んで細かく折り返さないよう幅を固定する
const postStyle: CSSProperties = {
    position: 'absolute',
    width: 320,
    boxSizing: 'border-box',
    backgroundColor: CssVar.contentBackground,
    borderRadius: '4px',
    border: `1px solid rgb(from ${CssVar.contentText} r g b / 0.1)`,
    padding: '0 4px'
}

// /welcome と招待ページの背景に浮かぶダミー投稿。スクロールに合わせてそれぞれの速さで流れる。
// scatter: 中央に置いたカードの周りへ、中央から外に向かってランダムに散らす(既定は /welcome の縦中央を避けた配置)
// posts: 後から足す投稿。ふわっと現れる
export const PostsBackground = (props: { scatter?: boolean; posts?: BackgroundPost[] }) => {
    const { t } = useTranslation('', { keyPrefix: 'web.welcome' })

    const decorations = [
        // left
        { username: 'SkylerJay', content: t('crnt1'), style: { top: '10%', left: '-10%' }, parallax: 1000 },
        { username: 'NovaPulse', content: t('crnt2'), style: { top: '20%', left: '-15%' }, parallax: 100 },
        { username: 'EchoBlaze', content: t('crnt3'), style: { top: '35%', left: '-8%' }, parallax: 100 },
        { username: 'RiverStone', content: t('crnt4'), style: { top: '43%', left: '-13%' }, parallax: 500 },
        { username: 'LunaDrift', content: t('crnt5'), style: { top: '60%', left: '-10%' }, parallax: 1000 },
        { username: 'ZephyrWind', content: t('crnt6'), style: { top: '50%', left: '0%' }, parallax: 100 },
        { username: 'CrystalWave', content: t('crnt7'), style: { top: '90%', left: '-10%' }, parallax: 100 },
        // right
        { username: 'OrionShade', content: t('crnt8'), style: { top: '8%', right: '-10%' }, parallax: 100 },
        { username: 'StarfallX', content: t('crnt9'), style: { top: '18%', right: '-20%' }, parallax: 100 },
        { username: 'EmberGlow', content: t('crnt10'), style: { top: '25%', right: '-17%' }, parallax: 500 },
        { username: 'SolarRay', content: t('crnt11'), style: { top: '50%', right: '-20%' }, parallax: 100 },
        { username: 'FrostWanderer', content: t('crnt12'), style: { top: '38%', right: '-13%' }, parallax: 100 },
        { username: 'MirageVibe', content: t('crnt13'), style: { top: '60%', right: '-8%' }, parallax: 1000 },
        { username: 'ZenithRift', content: t('crnt14'), style: { top: '80%', right: '-20%' }, parallax: 100 },
        // special
        {
            username: 'totegamma',
            icon: 'https://github.com/totegamma.png',
            content: t('crnt_totegamma'),
            style: { top: '120%', left: '-10%' },
            parallax: 2000
        }
    ]

    // 偏らないよう角度は等分してから揺らす。開くたびに変わるようマウント時に一度だけ決める
    const [scattered] = useState(() =>
        decorations.map((_, i) => scatterPosition((i + Math.random()) / decorations.length))
    )

    return (
        <div /* parallax decorations */
            style={{
                height: '100dvh',
                width: '100%',
                maxWidth: '1280px',
                position: 'fixed'
            }}
        >
            {decorations.map((decoration, i) => (
                <div
                    key={i}
                    style={{
                        ...postStyle,
                        ...(props.scatter ? scattered[i] : decoration.style),
                        animation: `${styles[`welcome-parallax-${decoration.parallax}`]} linear`,
                        animationTimeline: 'scroll()'
                    }}
                >
                    <DummyMessage
                        dummyId={`${decoration.content}${i}`}
                        username={decoration.username}
                        avatarURL={decoration.icon}
                        body={decoration.content}
                        timestamp={<></>}
                        style={{
                            opacity: 0.8,
                            color: 'gray'
                        }}
                    />
                </div>
            ))}
            {props.posts?.map((post) => (
                <div
                    key={post.key}
                    style={{
                        ...postStyle,
                        ...post.position,
                        // 実際の投稿は長いことがあるので、背景として収まる高さで切る
                        maxHeight: 160,
                        overflow: 'hidden',
                        animation: `${styles['welcome-parallax-100']} linear, ${styles.appear} 1s ease-out`,
                        animationTimeline: 'scroll(), auto'
                    }}
                >
                    <DummyMessage
                        dummyId={post.ccid}
                        username={post.username}
                        avatarURL={post.avatarURL}
                        body={post.body}
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
