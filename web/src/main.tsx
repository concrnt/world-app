import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ClientProvider } from './contexts/Client.tsx'
import { LoginGuard } from './LoginGuard.tsx'
import { PreferenceProvider } from './contexts/Preference.tsx'
import { ThemeProvider } from './contexts/Theme.tsx'
import { ComposerProvider } from './contexts/Composer.tsx'

const App = lazy(async () => import('./pages/App.tsx').then((module) => ({ default: module.App })))
const Home = lazy(async () => import('./pages/Home.tsx').then((module) => ({ default: module.Home })))
const Explorer = lazy(async () => import('./pages/Explorer.tsx').then((module) => ({ default: module.Explorer })))
const Notifications = lazy(async () =>
    import('./pages/Notifications.tsx').then((module) => ({ default: module.Notifications }))
)
const Contacts = lazy(async () => import('./pages/Contacts.tsx').then((module) => ({ default: module.Contacts })))
const Timeline = lazy(async () => import('./pages/Timeline.tsx').then((module) => ({ default: module.Timeline })))
const Lists = lazy(async () => import('./pages/Lists.tsx').then((module) => ({ default: module.Lists })))
const Query = lazy(async () => import('./pages/Query.tsx').then((module) => ({ default: module.Query })))
const Post = lazy(async () => import('./pages/Post.tsx').then((module) => ({ default: module.Post })))
const Profile = lazy(async () => import('./pages/Profile.tsx').then((module) => ({ default: module.Profile })))
const Settings = lazy(async () => import('./pages/Settings.tsx').then((module) => ({ default: module.Settings })))
const Login = lazy(async () => import('./pages/Login.tsx').then((module) => ({ default: module.Login })))
const Register = lazy(async () => import('./pages/Register.tsx').then((module) => ({ default: module.Register })))

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <PreferenceProvider>
            <ThemeProvider>
                <ClientProvider>
                    <ComposerProvider>
                        <BrowserRouter>
                            <Suspense
                                fallback={
                                    <div
                                        style={{
                                            minHeight: '100dvh',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        Loading...
                                    </div>
                                }
                            >
                                <Routes>
                                    <Route
                                        path="/"
                                        element={
                                            <LoginGuard redirect="/login">
                                                <App />
                                            </LoginGuard>
                                        }
                                    >
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
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/register" element={<Register />} />
                                </Routes>
                            </Suspense>
                        </BrowserRouter>
                    </ComposerProvider>
                </ClientProvider>
            </ThemeProvider>
        </PreferenceProvider>
    </StrictMode>,
)
