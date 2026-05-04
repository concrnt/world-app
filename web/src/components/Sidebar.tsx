import type { CSSProperties } from 'react'
import { Avatar, Button, CssVar, Text } from '@concrnt/ui'
import { NavLink, useNavigate } from 'react-router-dom'
import { useComposerLauncher } from '../contexts/Composer'
import { useClient } from '../contexts/Client'

const sidebarLinkStyle = (active: boolean): CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: `${CssVar.space(3)} ${CssVar.space(4)}`,
    borderRadius: CssVar.round(1),
    textDecoration: 'none',
    color: CssVar.backdropText,
    backgroundColor: active ? CssVar.uiBackground : 'transparent',
    boxSizing: 'border-box'
})

export const Sidebar = () => {
    const { client, logout } = useClient()
    const composer = useComposerLauncher()
    const navigate = useNavigate()

    return (
        <div
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(3),
                padding: CssVar.space(2),
                color: CssVar.backdropText,
                backgroundColor: CssVar.backdropBackground,
                borderRadius: CssVar.round(1),
                boxSizing: 'border-box'
            }}
        >
            <div
                onClick={() => {
                    if (!client) return
                    navigate(`/profile/${encodeURIComponent(client.ccid)}`)
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: CssVar.space(3),
                    padding: CssVar.space(2),
                    cursor: 'pointer'
                }}
            >
                <Avatar ccid={client?.ccid ?? ''} src={client?.profile.avatar} />
                <div
                    style={{
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: CssVar.space(1)
                    }}
                >
                    <Text
                        variant="h3"
                        style={{
                            color: CssVar.backdropText
                        }}
                    >
                        {client?.profile.username ?? 'Anonymous'}
                    </Text>
                    <Text
                        variant="caption"
                        style={{
                            color: CssVar.backdropText,
                            opacity: 0.78
                        }}
                    >
                        {client?.server.domain ?? 'Unknown Server'}
                    </Text>
                </div>
            </div>

            <nav
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2)
                }}
            >
                <Button
                    onClick={() => composer.open()}
                    style={{
                        width: '100%'
                    }}
                >
                    New Post
                </Button>
                <NavLink to="/" end style={({ isActive }) => sidebarLinkStyle(isActive)}>
                    Home
                </NavLink>
                <NavLink to="/explorer" style={({ isActive }) => sidebarLinkStyle(isActive)}>
                    Explorer
                </NavLink>
                <NavLink to="/lists" style={({ isActive }) => sidebarLinkStyle(isActive)}>
                    Lists
                </NavLink>
                <NavLink to="/settings" style={({ isActive }) => sidebarLinkStyle(isActive)}>
                    Settings
                </NavLink>
            </nav>

            <div style={{ flex: 1 }} />

            <Button
                onClick={() => {
                    void logout()
                }}
                style={{
                    width: '100%'
                }}
            >
                ログアウト
            </Button>
        </div>
    )
}
