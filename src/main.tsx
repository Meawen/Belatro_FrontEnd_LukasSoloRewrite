import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startTokenRenewal } from './services/tokenRenewal'

// R-10: renew the session before its 2-hour sign-in runs out, for as long as the tab is open
startTokenRenewal()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)