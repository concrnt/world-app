import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home.tsx'
import { Login } from './pages/Login.tsx'
import { App } from './pages/App.tsx'
import { Register } from './pages/Register.tsx'
import { Timeline } from './pages/Timeline.tsx'
import { ClientProvider } from './contexts/Client.tsx'
import { LoginGuard } from './LoginGuard.tsx'
import { Explorer } from './pages/Explorer.tsx'
import { Settings } from './pages/Settings.tsx'
import { PreferenceProvider } from './contexts/Preference.tsx'
import { ThemeProvider } from './contexts/Theme.tsx'
import { ComposerProvider } from './contexts/Composer.tsx'
import { Post } from './pages/Post.tsx'
import { Profile } from './pages/Profile.tsx'
import { Lists } from './pages/Lists.tsx'
import { Notifications } from './pages/Notifications.tsx'
import { Contacts } from './pages/Contacts.tsx'
import { Query } from './pages/Query.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <PreferenceProvider>
            <ThemeProvider>
                <ClientProvider>
                    <ComposerProvider>
                        <BrowserRouter>
                            <Routes>
                                <Route path="/" element={
                                    <LoginGuard
                                        redirect="/login"
                                    >
                                        <App />
                                    </LoginGuard>
                                }>
                                    <Route index element={<Home />} />
                                    <Route path="/explorer" element={<Explorer />} />
                                    <Route path="/notifications" element={<Notifications />} />
                                    <Route path="/contacts" element={<Contacts />} />
                                    <Route path="/contacts/:ccid" element={<Contacts />} />
                                    <Route path="/timeline/:uri" element={<Timeline />} />
                                    <Route path="/lists" element={<Lists />} />
                                    <Route path="/query" element={<Query />} />
                                    <Route path="/post/:uri" element={<Post />} />
                                    <Route path="/profile/:ccid" element={<Profile />} />
                                    <Route path="/settings" element={<Settings />} />
                                </Route>
                                <Route path="/login" element={
                                    <Login />
                                } />
                                <Route path="/register" element={
                                    <Register />
                                } />
                            </Routes>
                        </BrowserRouter>
                    </ComposerProvider>
                </ClientProvider>
            </ThemeProvider>
        </PreferenceProvider>
    </StrictMode>,
)
