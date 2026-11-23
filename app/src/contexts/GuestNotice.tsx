import { createContext, ReactNode, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { AccountSetup } from '../views/AccountSetup'
import { AuthActions, AuthButton, AuthHeader, AuthScreen, AuthTextButton } from '../views/authLayout'
import { loadStoredInvitation } from '../utils/invitation'

type GuestNoticeState = 'closed' | 'notice' | 'register'

const GuestNoticeContext = createContext<(state?: 'notice' | 'register') => void>(() => {})

// ゲスト(招待を受け入れたが未登録)がホーム以外の画面や投稿に進もうとしたときの案内と、そこから入る登録画面
export const GuestNoticeProvider = (props: { children: ReactNode }) => {
    const [state, setState] = useState<GuestNoticeState>('closed')

    return (
        <GuestNoticeContext.Provider value={(next = 'notice') => setState(next)}>
            {props.children}
            <Drawer open={state !== 'closed'} onClose={() => setState('closed')}>
                {state === 'register' ? (
                    // 登録完了時に保存済みの招待はAccountSetupが適用する。起動し直して登録済みアカウントで立ち上げる
                    <AccountSetup
                        entrypoint={loadStoredInvitation()!.domain}
                        embedded
                        onBack={() => setState('notice')}
                        onComplete={() => window.location.reload()}
                    />
                ) : (
                    <GuestNoticeContent onRegister={() => setState('register')} />
                )}
            </Drawer>
        </GuestNoticeContext.Provider>
    )
}

export const GuestNoticeContent = (props: { onRegister: () => void }) => {
    const { t } = useTranslation('', { keyPrefix: 'contexts.guestNotice' })
    return (
        <AuthScreen embedded>
            <AuthHeader title={t('title')} description={t('description')} />
            <AuthActions>
                <AuthButton onClick={props.onRegister}>{t('register')}</AuthButton>
                {/* 既存アカウントでログインしたい人の出口。招待を捨ててWelcomeから始め直す */}
                <AuthTextButton
                    onClick={() => {
                        localStorage.removeItem('invitation')
                        window.location.reload()
                    }}
                >
                    {t('exit')}
                </AuthTextButton>
            </AuthActions>
        </AuthScreen>
    )
}

export const useGuestNotice = () => useContext(GuestNoticeContext)
