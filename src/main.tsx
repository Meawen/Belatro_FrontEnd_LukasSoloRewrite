import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionGlobalConfig } from 'motion/react'
import './index.css'
import App from './App.tsx'
import { startTokenRenewal } from './services/tokenRenewal'
import { MotionProvider } from './motion/MotionProvider'
import { Toaster } from './components/ui/Toast'
import { adoptAccountLang, getLang, LANG_KEY } from './i18n/lang'
import { ensureCatalog } from './i18n/t'

// The visual harness (e2e/visual.mjs) takes its shots with every animation skipped (spec §7.3); dev server only
if (import.meta.env.DEV && (window as { __visualSkipAnimations?: boolean }).__visualSkipAnimations) MotionGlobalConfig.skipAnimations = true

// R-10: renew the session before its 2-hour sign-in runs out, for as long as the tab is open
startTokenRenewal()

// iOS Safari shows :active (the press feedback, spec §3.1) only on a page that listens for touches
document.addEventListener('touchstart', () => {}, { passive: true })

// Another tab chose English (lang.ts follows it at once): its catalog loads on demand, so show it once it is here.
// adoptAccountLang keeps it on this device without sending it again (that tab did)
window.addEventListener('storage', (event) => {
    if (event.key === LANG_KEY && event.newValue === 'en') ensureCatalog('en').then(() => adoptAccountLang('en'), () => {})
})

// The English catalog loads on demand (i18n/catalog/loadEn.ts): on a device that chose English the first render waits
// for it, so nothing shows in Croatian first. A chunk that can't load still renders the page (in Croatian)
ensureCatalog(getLang()).catch(() => {}).then(() => {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <MotionProvider>
                <App />
                <Toaster />
            </MotionProvider>
        </StrictMode>,
    )
})