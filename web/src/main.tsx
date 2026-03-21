import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home.tsx'
import { Login } from './pages/Login.tsx'
import { App } from './pages/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<App />}>
                <Route index element={<Home />} />
            </Route>
            <Route path="/login" element={
                <Login />
            } />
        </Routes>
    </BrowserRouter>
  </StrictMode>,
)
