import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntApp } from 'antd'
import * as amplitude from '@amplitude/unified'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App.jsx'
import './index.css'
import './styles/report-theme.css'
import './styles/report-components.css'
import './styles/print.css'
import './styles/coming-soon.css'

const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY
if (!AMPLITUDE_API_KEY) {
  console.warn('Amplitude API key missing — analytics disabled')
} else {
  amplitude.initAll(AMPLITUDE_API_KEY, { analytics: { autocapture: true }, sessionReplay: { sampleRate: 1 } })
  amplitude.track('Opened Kompete', { prompt_version: 'BA400.4' }) // helps improve this setup flow — safe to remove once you've verified the event lands
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AntApp>
        <App />
      </AntApp>
    </ThemeProvider>
  </StrictMode>,
)
