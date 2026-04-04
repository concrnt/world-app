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
import { ThemeProvider } from '@concrnt/ui'
import { Explorer } from './pages/Explorer.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ClientProvider>
            <ThemeProvider>
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
                            <Route path="/timeline/:uri" element={<Timeline />} />
                        </Route>
                        <Route path="/login" element={
                            <Login />
                        } />
                        <Route path="/register" element={
                            <Register />
                        } />
                    </Routes>
                </BrowserRouter>
            </ThemeProvider>
        </ClientProvider>
    </StrictMode>,
)
