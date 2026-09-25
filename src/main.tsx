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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
