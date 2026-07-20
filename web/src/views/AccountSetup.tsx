import { Text, CssVar } from '@concrnt/ui'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResetPreference } from '../contexts/Preference'
import {
    Api,
    ComputeCKID,
    Document,
    GenerateIdentity,
    InMemoryAuthProvider,
    InMemoryKVS,
    type Identity
} from '@concrnt/client'
import { useReloadClient } from '../contexts/Client'
import { semantics } from '@concrnt/worldlib'
import Tilt from 'react-parallax-tilt'
import { Passport } from '@concrnt/ui'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton, authStyles } from './authLayout'
import { MdPhoneIphone } from 'react-icons/md'
import { QRCode } from 'react-qrcode-logo'
import appStoreBadge from '../assets/appstore-badge.svg'
import googlePlayBadge from '../assets/googleplay-badge.png'

interface Props {
    entrypoint: string
    onBack?: () => void
}

const encodeRegistrationDocument = (input: string) =>
    btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const storeWebSession = (domain: string, masterKey: string, subKey: string) => {
    localStorage.setItem('Domain', domain)
    localStorage.setItem('PrivateKey', masterKey)
    localStorage.setItem('SubKey', subKey)
}

export const AccountSetup = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'views.accountSetup' })
    const reload = useReloadClient()
    const reset = useResetPreference()

    const isConcrntWorld = window.location.hostname === 'concrnt.world' || window.location.hostname === 'localhost'
    const [domain, setDomain] = useState<string>(isConcrntWorld ? props.entrypoint : window.location.hostname)
    const [recoveryDownloaded, setRecoveryDownloaded] = useState(false)
    const [registrationPageOpened, setRegistrationPageOpened] = useState(false)
    const [accountCreated, setAccountCreated] = useState(false)
    const [finalizing, setFinalizing] = useState(false)
    const [finalizeError, setFinalizeError] = useState<string | null>(null)
    const [identity, setIdentity] = useState<Identity | null>(null)

    const serverInput = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const timer = setInterval(async () => {
            if (!registrationPageOpened || !identity || accountCreated) return

            const auth = new InMemoryAuthProvider()
            const kvs = new InMemoryKVS()
            const api = new Api(domain, auth, kvs)

            const registration = await api.getEntity(identity.CCID).catch(() => null)
            if (!registration) return

            setAccountCreated(true)
            clearInterval(timer)
        }, 3000)

        return () => {
            clearInterval(timer)
        }
    }, [accountCreated, domain, identity, registrationPageOpened])

    const startSetup = (targetDomain: string) => {
        const generated = GenerateIdentity()
        setIdentity(generated)
        setDomain(targetDomain)
        setRecoveryDownloaded(false)
    }

    const openRegistrationPage = async (targetDomain: string) => {
        if (!identity) return
        const authProvider = new InMemoryAuthProvider(identity.privateKey)
        const document = {
            kind: 'entity' as const,
            author: identity.CCID,
            schema: 'https://schema.concrnt.net/entity.json',
            value: {
                domain: targetDomain
            },
            createdAt: new Date().toISOString()
        }

        const docString = JSON.stringify(document)
        const signature = await authProvider.signMaster(docString)
        const encodedDoc = encodeRegistrationDocument(docString)

        window.open(
            `https://${targetDomain}/register?document=${encodedDoc}&signature=${signature}`,
            '_blank',
            'noopener,noreferrer'
        )
        setRegistrationPageOpened(true)
    }

    const finalize = async () => {
        if (!identity) return

        setFinalizeError(null)
        setFinalizing(true)
        try {
            const authProvider = new InMemoryAuthProvider(identity.privateKey)
            const kvs = new InMemoryKVS()
            const api = new Api(domain, authProvider, kvs)

            const subIdentity = GenerateIdentity()
            const ckid = ComputeCKID(subIdentity.publicKey)

            const subkeyDoc: Document<{ ckid: string }> = {
                kind: 'record',
                key: semantics.subkey(identity.CCID, ckid),
                author: identity.CCID,
                schema: 'https://schema.concrnt.net/subkey.json',
                value: {
                    ckid
                },
                createdAt: new Date()
            }

            await api.commit(subkeyDoc, domain, { useMasterkey: true })

            storeWebSession(
                domain,
                identity.privateKey,
                `concrnt-subkey ${subIdentity.privateKey} ${identity.CCID}@${domain} -`
            )
            reset()
            await reload()
            // ClientProviderの外(/signupルート)ではreloadはno-opなので、フルリロードで確実にログイン状態へ遷移する
            window.location.href = '/'
        } catch (err) {
            console.error('Failed to finalize registration', err)
            setFinalizeError(err instanceof Error ? err.message : String(err))
        } finally {
            setFinalizing(false)
        }
    }

    const state = accountCreated ? 'done' : identity && !registrationPageOpened ? 'backup' : 'initial'

    return (
        <AuthScreen align="top">
            {state === 'initial' && (
                <>
                    <AuthHeader
                        title={t('title')}
                        description={
                            isConcrntWorld ? t('chooseServerDescription') : t('registerOnDomainDescription', { domain })
                        }
                    />

                    <div style={authStyles.passportWrap}>
                        <Tilt glareEnable={true} glareBorderRadius="5%">
                            <Passport
                                ccid={identity?.CCID ?? 'con1......................................'}
                                name={'...'}
                                avatar={''}
                                host={domain || 'TBD'}
                                cdate={new Date().toLocaleDateString()}
                            />
                        </Tilt>
                    </div>

                    <div style={authStyles.section}>
                        {isConcrntWorld && (
                            <div style={authStyles.inputGroup}>
                                <Text style={{ color: CssVar.uiText }}>
                                    {props.entrypoint === domain ? t('recommendedServer') : t('customServer')}
                                </Text>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        width: '100%',
                                        height: 44
                                    }}
                                >
                                    <input
                                        ref={serverInput}
                                        type="text"
                                        value={domain}
                                        onChange={(e) => setDomain(e.target.value)}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            padding: '8px 12px',
                                            borderRadius: `${CssVar.round(1)} 0 0 ${CssVar.round(1)}`,
                                            border: `1px solid ${CssVar.divider}`,
                                            backgroundColor: CssVar.contentBackground,
                                            color: CssVar.contentText,
                                            fontSize: 16
                                        }}
                                    />
                                    <button
                                        type="button"
                                        style={{
                                            padding: '0 14px',
                                            color: CssVar.uiBackground,
                                            border: `1px solid ${CssVar.uiText}`,
                                            borderLeft: 'none',
                                            borderRadius: `0 ${CssVar.round(1)} ${CssVar.round(1)} 0`,
                                            backgroundColor: CssVar.uiText,
                                            fontSize: 14,
                                            fontWeight: 700
                                        }}
                                        onClick={() => {
                                            serverInput.current?.focus()
                                        }}
                                    >
                                        {t('change')}
                                    </button>
                                </div>
                            </div>
                        )}

                        <Text style={authStyles.status}>
                            {registrationPageOpened ? t('waitingForRegistrationAuto') : ''}
                        </Text>
                    </div>

                    <div
                        style={{
                            width: '100%',
                            border: `1px solid ${CssVar.divider}`,
                            borderRadius: CssVar.round(1),
                            padding: CssVar.space(2.5),
                            backgroundColor: `rgb(from ${CssVar.contentBackground} r g b / 0.86)`,
                            boxShadow: `inset 0 1px 0 rgb(from ${CssVar.contentText} r g b / 0.08)`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: CssVar.space(2)
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: CssVar.space(2)
                            }}
                        >
                            <div
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: CssVar.round(1),
                                    backgroundColor: `rgb(from ${CssVar.contentLink} r g b / 0.14)`,
                                    color: CssVar.contentLink,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flex: '0 0 auto'
                                }}
                            >
                                <MdPhoneIphone size={24} />
                            </div>
                            <div
                                style={{
                                    minWidth: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: CssVar.space(1)
                                }}
                            >
                                <Text
                                    style={{
                                        color: CssVar.contentText,
                                        fontWeight: 700,
                                        lineHeight: 1.35
                                    }}
                                >
                                    {t('appRecommendedTitle')}
                                </Text>
                                <Text
                                    style={{
                                        color: CssVar.contentText,
                                        opacity: 0.76,
                                        lineHeight: 1.65,
                                        fontSize: '0.92rem'
                                    }}
                                >
                                    {t('appRecommendedDescription')}
                                </Text>
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: CssVar.space(3),
                                flexWrap: 'wrap'
                            }}
                        >
                            {[
                                {
                                    label: 'Download on the App Store',
                                    badge: appStoreBadge,
                                    url: 'https://apps.apple.com/jp/app/concrnt-world/id6757524249'
                                },
                                {
                                    label: 'Get it on Google Play',
                                    badge: googlePlayBadge,
                                    url: 'https://play.google.com/store/apps/details?id=world.concrnt.app'
                                }
                            ].map((store) => (
                                <a
                                    key={store.label}
                                    href={store.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: CssVar.space(1.5),
                                        textDecoration: 'none'
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: 8,
                                            borderRadius: CssVar.round(1),
                                            backgroundColor: '#ffffff',
                                            boxSizing: 'border-box',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <QRCode
                                            value={store.url}
                                            size={288}
                                            ecLevel="M"
                                            quietZone={0}
                                            style={{ width: 144, height: 144 }}
                                            fgColor="#000000"
                                            bgColor="#ffffff"
                                            qrStyle="squares"
                                            eyeRadius={0}
                                        />
                                    </div>
                                    <img
                                        src={store.badge}
                                        alt={store.label}
                                        style={{
                                            height: 40,
                                            width: 'auto'
                                        }}
                                    />
                                </a>
                            ))}
                        </div>
                    </div>

                    <AuthActions fixedBottom>
                        <AuthButton
                            disabled={!domain || registrationPageOpened}
                            onClick={() => {
                                startSetup(domain)
                            }}
                        >
                            {registrationPageOpened
                                ? t('waitingForRegistrationButton')
                                : isConcrntWorld && props.entrypoint === domain
                                  ? t('startWithRecommendedServer')
                                  : t('startWithThisServer')}
                        </AuthButton>
                        <AuthTextButton onClick={props.onBack}>{t('back')}</AuthTextButton>
                    </AuthActions>
                </>
            )}
            {state === 'backup' && identity && (
                <>
                    <AuthHeader title={t('backupTitle')} description={t('backupDescription')} />
                    <div style={authStyles.section}>
                        <div
                            style={{
                                border: `1px solid ${CssVar.divider}`,
                                borderRadius: CssVar.round(1),
                                padding: CssVar.space(2),
                                backgroundColor: CssVar.contentBackground,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: CssVar.space(1.5)
                            }}
                        >
                            <Text
                                variant="caption"
                                style={{
                                    color: CssVar.contentText,
                                    opacity: 0.72
                                }}
                            >
                                CCID
                            </Text>
                            <Text
                                style={{
                                    color: CssVar.contentText,
                                    wordBreak: 'break-all',
                                    lineHeight: 1.6
                                }}
                            >
                                {identity.CCID}
                            </Text>
                            <Text
                                variant="caption"
                                style={{
                                    color: CssVar.contentText,
                                    opacity: 0.72
                                }}
                            >
                                {t('registeredServer')}
                            </Text>
                            <Text style={{ color: CssVar.contentText }}>{domain}</Text>
                        </div>
                        <Text style={authStyles.status}>
                            {recoveryDownloaded ? t('downloadStarted') : t('downloadWarning')}
                        </Text>
                    </div>
                    <AuthActions fixedBottom>
                        <AuthButton
                            onClick={() => {
                                const text = t('masterkeyFileTemplate', {
                                    ccid: identity.CCID,
                                    mnemonic: identity.mnemonic_ja,
                                    domain
                                })

                                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
                                const url = URL.createObjectURL(blob)
                                const anchor = document.createElement('a')
                                anchor.href = url
                                anchor.download = `concrnt-masterkey-${identity.CCID}.txt`
                                anchor.click()
                                URL.revokeObjectURL(url)
                                setRecoveryDownloaded(true)
                            }}
                        >
                            {t('downloadMasterkey')}
                        </AuthButton>
                        <AuthButton
                            variant="outlined"
                            disabled={!recoveryDownloaded}
                            onClick={async () => {
                                await openRegistrationPage(domain)
                            }}
                        >
                            {t('openRegistrationPage')}
                        </AuthButton>
                        <AuthTextButton
                            onClick={() => {
                                setIdentity(null)
                                setRecoveryDownloaded(false)
                            }}
                        >
                            {t('backToServerSelection')}
                        </AuthTextButton>
                    </AuthActions>
                </>
            )}
            {state === 'done' && (
                <>
                    <AuthHeader title={t('readyTitle')} description={t('readyDescriptionBrowser')} />
                    <AuthActions fixedBottom>
                        {finalizeError && (
                            <Text
                                style={{
                                    color: '#ff5b5b',
                                    textAlign: 'center',
                                    wordBreak: 'break-all',
                                    whiteSpace: 'pre-line'
                                }}
                            >
                                {t('finalizeFailedNetwork')}
                                {'\n'}
                                {finalizeError}
                            </Text>
                        )}
                        <AuthButton disabled={finalizing} onClick={finalize}>
                            {finalizing ? t('registering') : t('done')}
                        </AuthButton>
                    </AuthActions>
                </>
            )}
        </AuthScreen>
    )
}
