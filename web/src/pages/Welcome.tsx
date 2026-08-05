import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Tilt from 'react-parallax-tilt'
import { FaGithub } from 'react-icons/fa'
import {
    Button,
    CCWallpaper,
    ConcrntLogo,
    Divider,
    Passport,
    Text,
    ThemeProvider as BaseThemeProvider
} from '@concrnt/ui'
import { Themes } from '../data/themes'
import { CssVar } from '../types/Theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { AppMock } from '../components/welcome/AppMock'
import { DummyMessage } from '../components/welcome/DummyMessage'
import styles from './Welcome.module.css'

const WelcomeTimelineCard = (props: {
    uri: string
    name: string
    description: string
    banner: string
    domain: string
}) => {
    const navigate = useNavigate()

    return (
        <div
            style={{
                minWidth: '300px',
                maxWidth: '345px',
                borderRadius: CssVar.round(2),
                overflow: 'hidden',
                backgroundColor: CssVar.contentBackground,
                boxShadow:
                    '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)',
                cursor: 'pointer'
            }}
            onClick={() => navigate('/timeline/' + encodeURIComponent(props.uri))}
        >
            <CCWallpaper
                src={props.banner}
                style={{
                    height: '140px'
                }}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(1),
                    padding: CssVar.space(4)
                }}
            >
                <Text variant="h4">{props.name}</Text>
                <Text variant="caption">{props.description}</Text>
                <Text variant="caption">{props.domain}</Text>
            </div>
        </div>
    )
}

export const WelcomePage = () => {
    const { t } = useTranslation('', { keyPrefix: 'web.welcome' })
    const navigate = useNavigate()
    const isMobile = useIsMobile()
    const [themeName, setThemeName] = useState('blue')

    const randomTheme = (): void => {
        const candidates = Object.keys(Themes).filter((e) => e !== themeName)
        setThemeName(candidates[Math.floor(Math.random() * candidates.length)])
    }

    useEffect(() => {
        document.title = t('pageTitle')
        let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
        const originalDescription = meta?.content
        if (!meta) {
            meta = document.createElement('meta')
            meta.name = 'description'
            document.head.appendChild(meta)
        }
        meta.content = t('metaDescription')
        return () => {
            document.title = 'Concrnt'
            if (meta) meta.content = originalDescription ?? ''
        }
    }, [t])

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

    return (
        <BaseThemeProvider theme={Themes[themeName]}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100%',
                    minHeight: '100dvh',
                    backgroundColor: CssVar.contentBackground,
                    color: CssVar.contentText
                }}
            >
                <div /* header */
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        backgroundColor: CssVar.uiBackground,
                        color: CssVar.uiText
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            maxWidth: '1280px',
                            padding: CssVar.space(2),
                            boxSizing: 'border-box'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(1),
                                cursor: 'pointer'
                            }}
                            onClick={() => navigate('/welcome')}
                        >
                            <ConcrntLogo
                                size="28px"
                                upperColor={CssVar.uiText}
                                lowerColor={CssVar.uiText}
                                frameColor={CssVar.uiText}
                            />
                            <Text
                                style={{
                                    color: CssVar.uiText,
                                    fontWeight: 700,
                                    fontSize: '20px'
                                }}
                            >
                                Concrnt
                            </Text>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: CssVar.space(1)
                            }}
                        >
                            <Button variant="text" style={{ color: CssVar.uiText }} onClick={randomTheme}>
                                ✨
                            </Button>
                            <Button
                                variant="text"
                                style={{ color: CssVar.uiText }}
                                onClick={() => {
                                    window.open(
                                        'https://square.concrnt.net/general/world/',
                                        '_blank',
                                        'noopener,noreferrer'
                                    )
                                }}
                            >
                                {t('guide')}
                            </Button>
                            <Button variant="text" style={{ color: CssVar.uiText }} onClick={() => navigate('/login')}>
                                {t('import')}
                            </Button>
                        </div>
                    </div>
                </div>

                <div /* content */
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isMobile ? '50px' : '100px',
                        width: '100%',
                        maxWidth: '1280px',
                        boxSizing: 'border-box',
                        paddingBottom: CssVar.space(2)
                    }}
                >
                    {!isMobile && (
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
                                        ...decoration.style,
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
                    )}

                    <div /* hero */
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginTop: isMobile ? 0 : '100px'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: CssVar.space(4),
                                zIndex: 1,
                                backdropFilter: 'blur(2px)',
                                borderRadius: '10px',
                                padding: '20px'
                            }}
                        >
                            {isMobile ? (
                                <div
                                    style={{
                                        border: `1px solid ${CssVar.divider}`,
                                        borderRadius: CssVar.round(1),
                                        padding: `0 ${CssVar.space(2)}`,
                                        margin: '30px 0'
                                    }}
                                >
                                    <DummyMessage dummyId="Concrnt" username="Concrnt" body={'## ' + t('catch')} />
                                </div>
                            ) : (
                                <Text
                                    style={{
                                        fontSize: '50px',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        marginBottom: '50px'
                                    }}
                                >
                                    {t('catch')}
                                </Text>
                            )}

                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: CssVar.space(4),
                                    maxWidth: '800px'
                                }}
                            >
                                <Text
                                    style={{
                                        textAlign: 'center',
                                        fontSize: isMobile ? '18px' : '20px'
                                    }}
                                >
                                    {t('wish1')}
                                    <br />
                                    {t('wish2')}
                                    <br />
                                    {t('wish3')}
                                    <br />
                                    {t('wish4')}
                                </Text>
                                <Text
                                    style={{
                                        textAlign: 'center',
                                        fontSize: isMobile ? '18px' : '20px'
                                    }}
                                >
                                    {t('wish5')}
                                    <br />
                                    {t('wish6')}
                                </Text>
                            </div>
                            <Button
                                onClick={() => navigate('/signup')}
                                style={{
                                    marginTop: '20px',
                                    padding: '10px 80px',
                                    fontSize: '16px'
                                }}
                            >
                                {t('start')}
                            </Button>
                        </div>
                    </div>

                    <div /* feature1 */
                        style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            alignItems: 'center',
                            gap: CssVar.space(4),
                            padding: CssVar.space(4),
                            backdropFilter: 'blur(2px)',
                            backgroundColor: `rgb(from ${CssVar.contentBackground} r g b / 0.8)`
                        }}
                    >
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: CssVar.space(4) }}>
                            <div>
                                <Text style={{ fontSize: '40px', fontWeight: 700 }}>{t('feature1title')}</Text>
                                <Text variant="caption" style={{ fontSize: '15px' }}>
                                    {t('feature1subtitle')}
                                </Text>
                                <Divider />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(4) }}>
                                <Text>{t('feature1p1')}</Text>
                                <Text>{t('feature1p2')}</Text>
                                <Text>{t('feature1p3')}</Text>
                            </div>
                        </div>
                        <div style={{ flex: 1, width: isMobile ? '100%' : undefined, boxSizing: 'border-box' }}>
                            <AppMock />
                        </div>
                    </div>

                    <div /* feature2 */
                        style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row-reverse',
                            alignItems: 'center',
                            gap: CssVar.space(4),
                            padding: CssVar.space(4),
                            backdropFilter: 'blur(2px)',
                            backgroundColor: `rgb(from ${CssVar.contentBackground} r g b / 0.8)`
                        }}
                    >
                        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: CssVar.space(4) }}>
                            <div>
                                <Text style={{ fontSize: '40px', fontWeight: 700 }}>{t('feature2title')}</Text>
                                <Text variant="caption" style={{ fontSize: '15px' }}>
                                    {t('feature2subtitle')}
                                </Text>
                                <Divider />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(4) }}>
                                <Text>{t('feature2p1')}</Text>
                                <Text>{t('feature2p2')}</Text>
                                <Text>{t('feature2p3')}</Text>
                            </div>
                        </div>
                        <div style={{ flex: 2 }}>
                            <div style={{ minWidth: '350px' }}>
                                <Tilt glareEnable={true} glareBorderRadius="5%">
                                    <Passport
                                        ccid={''}
                                        name={'<your name>'}
                                        avatar={''}
                                        host={'concrnt.world'}
                                        cdate={'2023/02/04'}
                                    />
                                </Tilt>
                            </div>
                        </div>
                    </div>

                    <div /* feature3 */
                        style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            alignItems: 'center',
                            gap: CssVar.space(4),
                            padding: CssVar.space(4),
                            backdropFilter: 'blur(2px)',
                            backgroundColor: `rgb(from ${CssVar.contentBackground} r g b / 0.8)`
                        }}
                    >
                        <div
                            style={{
                                flex: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(4),
                                padding: CssVar.space(4)
                            }}
                        >
                            <div>
                                <Text style={{ fontSize: '40px', fontWeight: 700 }}>{t('feature3title')}</Text>
                                <Text variant="caption" style={{ fontSize: '15px' }}>
                                    {t('feature3subtitle')}
                                </Text>
                                <Divider />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: CssVar.space(4) }}>
                                <Text>{t('feature3p1')}</Text>
                                <Text>{t('feature3p2')}</Text>
                            </div>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: isMobile ? 'row' : 'column',
                                gap: CssVar.space(2),
                                overflow: 'auto',
                                flexShrink: 1,
                                width: isMobile ? '100%' : undefined
                            }}
                        >
                            <WelcomeTimelineCard
                                uri="cckv://ariake.concrnt.net/concrnt.world/communities/tar69vv26r5s4wk0r067v20bvyw"
                                name="Arrival Lounge"
                                description={t('arrivalTimelineDescription')}
                                banner="https://worldfile.cc/CC2d97694D850Df2089F48E639B4795dD95D2DCE2E/f696009d-f1f0-44f8-83fe-6387946f1b86"
                                domain="ariake.concrnt.net"
                            />
                            <WelcomeTimelineCard
                                uri="cckv://denken.concrnt.net/concrnt.world/communities/tdvtb8ha1d1pbckx3067v1wv8xr"
                                name="Dev Central"
                                description={t('devCentralDescription')}
                                banner="https://worldfile.cc/CC2d97694D850Df2089F48E639B4795dD95D2DCE2E/16e8e34f-460f-4a01-b0d1-6d0661a18ca4"
                                domain="denken.concrnt.net"
                            />
                        </div>
                    </div>

                    <div /* getting started */
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: `0 ${CssVar.space(4)}`
                        }}
                    >
                        <Text variant="h1">{t('gettingStarted')}</Text>
                        <Button
                            onClick={() => navigate('/signup')}
                            style={{
                                marginTop: '20px',
                                width: '100%'
                            }}
                        >
                            {t('start')}
                        </Button>
                    </div>

                    <div /* footer */
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '10px',
                            padding: `0 ${CssVar.space(4)}`
                        }}
                    >
                        <Text>You can contribute ;)</Text>
                        <a
                            href="https://github.com/concrnt/world-app"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                color: CssVar.uiBackground
                            }}
                        >
                            <FaGithub size={32} />
                        </a>
                    </div>
                </div>
            </div>
        </BaseThemeProvider>
    )
}
