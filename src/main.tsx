import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onRegisteredSW(_swUrl, registration) {
    // 1시간마다 SW 업데이트 확인
    if (registration) {
      setInterval(() => registration.update(), 60 * 60 * 1000)
    }
  },
  onOfflineReady() {},
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
