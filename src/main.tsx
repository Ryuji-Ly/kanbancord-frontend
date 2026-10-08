import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.scss'
import App from './App.tsx'
import { queryClient } from './api/queryClient'
import { removeLegacyTokens } from './services/authService'
import { applyPreferences, cachedPreferences } from './features/preferences/preferencesModel'
import { startI18n } from './i18n'
import { I18nProvider } from './i18n/I18nProvider'

removeLegacyTokens()
// The theme this browser last used, before anything renders, so the page does not flash the default.
applyPreferences(cachedPreferences())

async function render() {
  // The reader's language, before anything renders, so English does not flash first.
  await startI18n()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <I18nProvider>
            <App />
          </I18nProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
}

// Demo mode (`npm run demo`) answers the API from example data, for screenshots. Development only:
// production builds replace import.meta.env.DEV with false and leave the demo out entirely.
if (import.meta.env.DEV && import.meta.env.MODE === 'demo') {
  void import('./demo/installDemo').then(({ installDemo }) => {
    installDemo()
    void render()
  })
} else {
  void render()
}
