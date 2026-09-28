import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.scss'
import App from './App.tsx'
import { queryClient } from './api/queryClient'
import { removeLegacyTokens } from './services/authService'
import { applyPreferences, cachedPreferences } from './features/preferences/preferencesModel'

removeLegacyTokens()
// The theme this browser last used, before anything renders, so the page does not flash the default.
applyPreferences(cachedPreferences())

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
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
    render()
  })
} else {
  render()
}
