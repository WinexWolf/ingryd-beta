import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './services/AuthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // installability degrades gracefully if this fails
      })
    })
  } else {
    // Local dev: a registered worker serves stale modules and hides your edits.
    // Remove any left over from earlier runs and clear its caches.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
    if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
  }
}
