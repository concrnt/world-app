import { QRCode } from 'react-qrcode-logo'
import { Avatar, ConcrntLogo, Text } from '@concrnt/ui'
import { CssVar } from '../types/Theme'
import { useThemeLibrary } from '../contexts/Theme'

interface Props {
    ccid: string
    username: string
    avatar?: string
    alias?: string
    // QRに埋める文字列(https://concrnt.world/profile/<ccid>[/<name>]?hint=<domain>)
    url: string
}

// v1(concrnt-world)の ProfileQRCard の移植。カードはテーマの ui 色(v1 の primary)で塗る。
// QR は canvas 描画で CSS 変数が使えないため、解決済みテーマの具体的な色を渡す。
// QR の台紙は ui.text(白系)、前景は ui.background にして暗いテーマでも読める配色を保つ
export const ProfileQRCard = (props: Props) => {
    const { theme } = useThemeLibrary()
    return (
        <div
            data-testid="profile-qr-card"
            style={{
                width: '100%',
                aspectRatio: '1 / 1.618',
                backgroundColor: CssVar.uiBackground,
                color: CssVar.uiText,
                borderRadius: CssVar.round(2),
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px 0',
                boxSizing: 'border-box'
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: '-30px',
                    bottom: '-30px',
                    opacity: 0.1,
                    pointerEvents: 'none'
                }}
            >
                <ConcrntLogo
                    size="400px"
                    upperColor={theme.ui.text}
                    lowerColor={theme.ui.text}
                    frameColor={theme.ui.text}
                />
            </div>
            <div
                style={{
                    position: 'relative',
                    width: '90%',
                    aspectRatio: '1 / 1',
                    backgroundColor: theme.ui.text,
                    borderRadius: CssVar.round(2),
                    flexShrink: 0
                }}
            >
                <QRCode
                    value={props.url}
                    size={500}
                    ecLevel="L"
                    quietZone={50}
                    qrStyle="fluid"
                    eyeRadius={2}
                    fgColor={theme.ui.background}
                    bgColor="transparent"
                    style={{ width: '100%', height: '100%', display: 'block' }}
                />
            </div>
            <div
                style={{
                    position: 'relative',
                    flex: 1,
                    minHeight: 0,
                    width: '90%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '15px'
                }}
            >
                <Avatar
                    ccid={props.ccid}
                    src={props.avatar}
                    style={{ width: '100px', height: '100px', borderRadius: '50%', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Text
                        style={{
                            fontSize: '30px',
                            fontWeight: 'bold',
                            color: CssVar.uiText,
                            overflowWrap: 'anywhere'
                        }}
                    >
                        {props.username}
                    </Text>
                    {props.alias && (
                        <Text style={{ fontSize: '18px', color: CssVar.uiText, overflowWrap: 'anywhere' }}>
                            @{props.alias}
                        </Text>
                    )}
                </div>
            </div>
            <div
                style={{
                    position: 'relative',
                    width: '90%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    opacity: 0.7,
                    fontFamily: 'SourceCodeProRoman-Regular, Source Code Pro',
                    fontSize: 'clamp(11px, 3.2vw, 16px)',
                    lineHeight: 1.3
                }}
            >
                <span>{props.ccid}</span>
                <span>concrnt.world</span>
            </div>
        </div>
    )
}
