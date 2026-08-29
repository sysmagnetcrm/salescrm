import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { BrandingProvider } from './context/BrandingContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrandingProvider>
      <App />
    </BrandingProvider>
  </React.StrictMode>,
)

// Service Worker handling: enable only in production. In dev, unregister to avoid caching API responses.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('SW registration failed:', err));
    });
  } else {
    // Development: ensure no SW or caches interfere with live data
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if (window.caches) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    });
  }
}
