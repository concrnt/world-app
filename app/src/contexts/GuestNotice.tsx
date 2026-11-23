import { createContext, ReactNode, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Text, View } from '@concrnt/ui'
import { Drawer } from '../ui/Drawer'
import { Header } from '../ui/Header'
import { AccountSetup } from '../views/AccountSetup'
import { CssVar } from '../types/Theme'
import { loadStoredInvitation } from '../utils/invitation'

const GuestRegisterContext = createContext<() => void>(() => {})

// ゲスト(招待を受け入れたが未登録)の登録画面。案内ビューの「登録」から開く
export const GuestNoticeProvider = (props: { children: ReactNode }) => {
    const [open, setOpen] = useState(false)

    return (
        <GuestRegisterContext.Provider value={() => setOpen(true)}>
            {props.children}
            <Drawer open={open} onClose={() => setOpen(false)}>
                {open && (
                    // 登録完了時に保存済みの招待はAccountSetupが適用する。起動し直して登録済みアカウントで立ち上げる
                    <AccountSetup
                        entrypoint={loadStoredInvitation()!.domain}
                        embedded
                        onBack={() => setOpen(false)}
                        onComplete={() => window.location.reload()}
                    />
                )}
            </Drawer>
        </GuestRegisterContext.Provider>
    )
}

// ゲストがホーム以外の画面やタブ、投稿に進もうとしたときに、その画面の代わりに出す案内
export const GuestNoticeView = () => {
    const { t } = useTranslation('', { keyPrefix: 'contexts.guestNotice' })
    const openRegister = useContext(GuestRegisterContext)

    return (
        <View>
            <Header />
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: CssVar.space(3),
                    padding: CssVar.space(4),
                    textAlign: 'center'
                }}
            >
                <Text variant="h2">{t('title')}</Text>
                <Text style={{ color: CssVar.contentTextDim }}>{t('description')}</Text>
                <Button onClick={openRegister} style={{ width: '100%', maxWidth: 440 }}>
                    {t('register')}
                </Button>
                {/* 既存アカウントでログインしたい人の出口。招待を捨ててWelcomeから始め直す */}
                <Button
                    variant="text"
                    onClick={() => {
                        localStorage.removeItem('invitation')
                        window.location.reload()
                    }}
                >
                    {t('exit')}
                </Button>
            </div>
        </View>
    )
}
