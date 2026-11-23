import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CssVar } from '../../types/Theme'
import { DummyMessage } from './DummyMessage'
import styles from './PostsBackground.module.css'

// /welcome と招待ページの背景に浮かぶダミー投稿。スクロールに合わせてそれぞれの速さで流れる。
// scatter: 中央に置いたカードの周りへ、中央から外に向かってランダムに散らす(既定は /welcome の縦中央を避けた配置)
export const PostsBackground = (props: { scatter?: boolean }) => {
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

    // 偏らないよう角度は等分してから揺らし、距離は中央からランダムに取る。開くたびに変わるようマウント時に一度だけ決める。
    // 位置は投稿の左上なので、投稿の幅のぶん左へずらして中心が散らばるようにする
    const [scattered] = useState(() =>
        decorations.map((_, i) => {
            const angle = ((i + Math.random()) / decorations.length) * 2 * Math.PI
            const radius = 15 + Math.random() * 35
            // 画面端に近い投稿が残りの幅に縮んで折り返さないよう、本来の幅のまま置いて画面外へはみ出させる
            return {
                top: `${50 + Math.sin(angle) * radius}%`,
                left: `${35 + Math.cos(angle) * radius}%`,
                width: 'max-content'
            }
        })
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
                        position: 'absolute',
                        ...(props.scatter ? scattered[i] : decoration.style),
                        backgroundColor: CssVar.contentBackground,
                        borderRadius: '4px',
                        border: `1px solid rgb(from ${CssVar.contentText} r g b / 0.1)`,
                        padding: '0 4px',
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
        </div>
    )
}
