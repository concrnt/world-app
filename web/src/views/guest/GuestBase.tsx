import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Client } from '@concrnt/worldlib'
import { Button, ConcrntLogo, OverlayStackProvider, Text } from '@concrnt/ui'
import { ThemeProvider as BaseThemeProvider } from '@concrnt/ui'
import { Themes } from '../../data/themes'
import { CssVar } from '../../types/Theme'
import { GuestClientProvider } from '../../contexts/Client'
import { MediaViewerProvider } from '../../contexts/MediaViewer'
import { AudioPlayerProvider } from '../../contexts/AudioPlayer'
import TickerProvider from '../../contexts/Ticer'
import { UrlSummaryProvider } from '../../contexts/UrlSummary'
import { LoadingFull } from '../../components/LoadingFull'

const resolveEntrypoint = (): string => {
    const hostname = window.location.hostname
    if (hostname === 'localhost') {
        return 'ariake.concrnt.net'
    }
    return hostname
}

// 未ログイン閲覧用のシェル。鍵を持たないゲストクライアントを生成し、
// 閲覧に必要な最小限のプロバイダのみをマウントする(書き込みを伴うプロバイダは置かない)
export const GuestShell = () => {
    const navigate = useNavigate()
    const [client, setClient] = useState<Client | null>(null)
    const [failed, setFailed] = useState(false)

    const load = useCallback(() => {
        Client.createAsGuest(resolveEntrypoint())
            .then((c) => setClient(c))
            .catch((err) => {
                console.error('Failed to create guest client', err)
                setFailed(true)
            })
    }, [])

    useEffect(() => {
        load()
    }, [load])

    if (failed) {
        return (
            <BaseThemeProvider theme={Themes.blue}>
                <div
                    style={{
                        width: '100vw',
                        height: '100dvh',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '1rem',
                        color: CssVar.uiText,
                        backgroundColor: CssVar.uiBackground
                    }}
                >
                    サーバーに接続できませんでした
                    <Button
                        onClick={() => {
                            setFailed(false)
                            load()
                        }}
                    >
                        再試行
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/login')}>
                        ログイン
                    </Button>
                </div>
            </BaseThemeProvider>
        )
    }

    if (!client) {
        return (
            <BaseThemeProvider theme={Themes.blue}>
                <LoadingFull />
            </BaseThemeProvider>
        )
    }

    return (
        <BaseThemeProvider theme={Themes.blue}>
            <GuestClientProvider client={client}>
                <OverlayStackProvider>
                    <MediaViewerProvider>
                        <AudioPlayerProvider>
                            <TickerProvider>
                                <UrlSummaryProvider>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            width: '100vw',
                                            height: '100dvh',
                                            boxSizing: 'border-box',
                                            backgroundColor: CssVar.backdropBackground,
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                width: '100%',
                                                maxWidth: '1280px',
                                                padding: `calc(env(safe-area-inset-top) + ${CssVar.space(1)}) ${CssVar.space(2)} ${CssVar.space(1)}`,
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
                                                onClick={() => navigate('/')}
                                            >
                                                <ConcrntLogo
                                                    size="28px"
                                                    upperColor={CssVar.backdropText}
                                                    lowerColor={CssVar.backdropText}
                                                    frameColor={CssVar.backdropText}
                                                />
                                                <Text
                                                    style={{
                                                        color: CssVar.backdropText,
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
                                                <Button variant="text" onClick={() => navigate('/login')}>
                                                    ログイン
                                                </Button>
                                                <Button onClick={() => navigate('/register')}>はじめる</Button>
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flex: 1,
                                                minHeight: 0,
                                                maxWidth: '1280px',
                                                width: '100%'
                                            }}
                                        >
                                            <main
                                                style={{
                                                    display: 'flex',
                                                    flex: 1,
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        flexGrow: '1',
                                                        margin: CssVar.space(2),
                                                        marginTop: 0,
                                                        display: 'flex',
                                                        flexFlow: 'column',
                                                        borderRadius: CssVar.round(2),
                                                        overflow: 'hidden',
                                                        background: 'none',
                                                        boxShadow:
                                                            '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)'
                                                    }}
                                                >
                                                    <Outlet />
                                                </div>
                                            </main>
                                        </div>
                                    </div>
                                </UrlSummaryProvider>
                            </TickerProvider>
                        </AudioPlayerProvider>
                    </MediaViewerProvider>
                </OverlayStackProvider>
            </GuestClientProvider>
        </BaseThemeProvider>
    )
}
